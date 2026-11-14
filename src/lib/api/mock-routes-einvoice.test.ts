/**
 * Mock hoá đơn điện tử (BE module `invoicing`, docs 21) — chạy qua axios thật + lớp api của
 * `features/einvoice`: kiểm mock đúng hình BE và lớp api parse được. Kịch bản: nháp → phát hành
 * (bất đồng bộ) → ISSUED; chặn phát hành thiếu bên mua (BR-06); khoá lạc quan; điều chỉnh / thay thế (BR-08).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adjustEInvoice,
  getEInvoice,
  getFileLink,
  issueEInvoice,
  listCorrections,
  listEInvoices,
  reconcileEInvoice,
  recordErrorNotice,
  reopenEInvoice,
  replaceEInvoice,
  resubmitEInvoice,
  reviseDraft,
  voidDraft,
} from "@/features/einvoice/api";
import { changeAutoIssue, getEInvoiceSettings } from "@/features/einvoice/settings-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { activateMockAdapter } from "./mock-adapter";
import { resetEInvoiceMockStore } from "./mock-einvoice-store";

const originalAdapter = api.defaults.adapter;

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  // Mock adapter trả lỗi ngẫu nhiên 5% (giả lập mạng) — cố định để test ổn định
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-ACC-01"));
afterEach(() => {
  resetEInvoiceMockStore();
  vi.useRealTimers();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /einvoices", () => {
  it("lists what is still to issue first and filters by status and order", async () => {
    const all = await listEInvoices({ page: 0, size: 50 });
    expect(all.totalElements).toBe(10);
    expect(all.items[0]?.issuedAt).toBeFalsy();
    const drafts = await listEInvoices({ status: "DRAFT" });
    expect(drafts.items.every((i) => i.status === "DRAFT")).toBe(true);
    const ofOrder = await listEInvoices({ orderId: "ORD-2026-0011" });
    expect(ofOrder.items.map((i) => i.type).sort()).toEqual(["ADJUSTMENT", "ORIGINAL"]);
  });

  it("without einvoices:READ the list is 403", async () => {
    actAs("USER-WH-01");
    expect((await errorOf(listEInvoices({}))).status).toBe(403);
  });
});

describe("issuing (docs 21 §4.2)", () => {
  it("answers SUBMITTING at once, then ISSUED with a number once the provider answered", async () => {
    const draft = await getEInvoice("EINV-0001");
    const sent = await issueEInvoice({ id: draft.id, version: draft.version });
    expect(sent.status).toBe("SUBMITTING");
    expect(sent.invoiceNumber).toBeFalsy();
    const issued = await reconcileEInvoice({ id: draft.id });
    expect(issued).toMatchObject({ status: "ISSUED", hasFiles: true });
    expect(issued.invoiceNumber).toBeGreaterThan(0);
    expect((await getFileLink(draft.id, "PDF")).url).toContain(".pdf");
  });

  it("BR-06: refuses a draft whose buyer has no tax code until the buyer is corrected", async () => {
    const draft = await getEInvoice("EINV-0002");
    expect(draft.warnings).toContain("BUYER_PROFILE_INCOMPLETE");
    const refused = await errorOf(issueEInvoice({ id: draft.id, version: draft.version }));
    expect(refused).toMatchObject({ status: 409, code: "EINVOICE_BUYER_PROFILE_INCOMPLETE" });
    const fixed = await reviseDraft({
      id: draft.id,
      version: draft.version,
      buyerTaxCode: "0109876543",
    });
    expect(fixed.warnings).not.toContain("BUYER_PROFILE_INCOMPLETE");
    expect((await issueEInvoice({ id: fixed.id, version: fixed.version })).status).toBe(
      "SUBMITTING",
    );
  });

  it("refuses a stale version with 409 OPTIMISTIC_LOCK", async () => {
    const draft = await getEInvoice("EINV-0001");
    await reviseDraft({ id: draft.id, version: draft.version, buyerName: "A" });
    const stale = await errorOf(issueEInvoice({ id: draft.id, version: draft.version }));
    expect(stale).toMatchObject({ status: 409, code: "OPTIMISTIC_LOCK" });
  });

  it("files are 409 EINVOICE_NOT_ISSUED before issuing", async () => {
    expect(await errorOf(getFileLink("EINV-0001", "XML"))).toMatchObject({
      code: "EINVOICE_NOT_ISSUED",
    });
  });

  it("a rejected invoice goes back to a draft; a voided draft is final", async () => {
    const rejected = await getEInvoice("EINV-0004");
    expect((await reopenEInvoice({ id: rejected.id, version: rejected.version })).status).toBe(
      "DRAFT",
    );
    const draft = await getEInvoice("EINV-0001");
    const voided = await voidDraft({ id: draft.id, version: draft.version, reason: "Lập sai" });
    expect(voided).toMatchObject({ status: "VOIDED_DRAFT", voidReason: "Lập sai" });
  });

  it("BR-05: an invoice unknown to the provider is sent again only as a new transaction", async () => {
    const stuck = await getEInvoice("EINV-0003");
    expect(stuck.warnings).toContain("UNKNOWN_TO_PROVIDER");
    expect((await reconcileEInvoice({ id: stuck.id })).status).toBe("SUBMITTING");
    const again = await resubmitEInvoice({ id: stuck.id, version: stuck.version });
    expect(again.warnings).not.toContain("UNKNOWN_TO_PROVIDER");
  });
});

describe("corrections (docs 21 §4.4, BR-08)", () => {
  it("draws an adjustment as a draft naming the original", async () => {
    const original = await getEInvoice("EINV-0007");
    const draft = await adjustEInvoice({
      id: original.id,
      basis: "TRADE_DISCOUNT",
      reason: "Chiết khấu doanh số",
      lines: [{ originalLineId: original.lines[0]!.id, quantity: -100 }],
    });
    expect(draft).toMatchObject({
      type: "ADJUSTMENT",
      status: "DRAFT",
      originalEInvoiceId: original.id,
    });
    expect((await listCorrections(original.id)).map((c) => c.id)).toContain(draft.id);
  });

  it("refuses to replace an invoice that was adjusted", async () => {
    const adjusted = await getEInvoice("EINV-0005");
    expect(adjusted.adjusted).toBe(true);
    expect(
      await errorOf(replaceEInvoice({ id: adjusted.id, reason: "x", lines: [] })),
    ).toMatchObject({ code: "EINVOICE_CORRECTION_FORM_FIXED" });
  });

  it("records a buyer name/address error notice once at a time", async () => {
    const notice = await recordErrorNotice({
      id: "EINV-0007",
      reason: "Sai địa chỉ",
      correctBuyerAddress: "1 A",
    });
    expect(notice).toMatchObject({ status: "SENT", formCode: "04/SS-HDDT" });
    expect(
      await errorOf(
        recordErrorNotice({ id: "EINV-0007", reason: "Lần nữa", correctBuyerName: "B" }),
      ),
    ).toMatchObject({ code: "EINVOICE_ERROR_NOTICE_NOT_SENDABLE" });
  });
});

describe("settings (docs 21 BR-10)", () => {
  it("the accountant reads but may not change them; the admin may", async () => {
    const current = await getEInvoiceSettings();
    expect(current).toMatchObject({ autoIssue: false, secretSet: false });
    expect(
      (await errorOf(changeAutoIssue({ autoIssue: true, version: current.version }))).status,
    ).toBe(403);
    actAs("USER-ADMIN-01");
    expect((await changeAutoIssue({ autoIssue: true, version: current.version })).autoIssue).toBe(
      true,
    );
  });
});
