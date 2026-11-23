/**
 * Mock hoá đơn điện tử (BE module `invoicing`, docs 21) — chạy qua axios thật + lớp api của
 * `features/einvoice`: kiểm mock đúng hình BE và lớp api parse được. Kịch bản: nháp → phát hành
 * (bất đồng bộ) → ISSUED; chặn phát hành thiếu bên mua (BR-06); khoá lạc quan; điều chỉnh / thay thế (BR-08).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adjustEInvoice,
  checkSignature,
  getEInvoice,
  getFileLink,
  getSignature,
  issueEInvoice,
  listCorrections,
  listEInvoices,
  reconcileEInvoice,
  recordErrorNotice,
  recordExternalReduction,
  recordPortalResult,
  reopenEInvoice,
  replaceEInvoice,
  resubmitEInvoice,
  reviseDraft,
  voidDraft,
} from "@/features/einvoice/api";
import {
  changeAutoIssue,
  getEInvoiceSettings,
  selectSeries,
  storeProviderAccount,
} from "@/features/einvoice/settings-api";
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
    expect(all.totalElements).toBe(14);
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
    // Seed giao ngày 10/11 — phát hành hôm nay là lập trễ: BE đòi lý do (WF-05 Q-10)
    const noReason = await errorOf(issueEInvoice({ id: draft.id, version: draft.version }));
    expect(noReason).toMatchObject({ status: 400, code: "EINVOICE_LATE_ISSUE_REASON_REQUIRED" });
    const sent = await issueEInvoice({
      id: draft.id,
      version: draft.version,
      lateReason: "Hãng báo giao trễ",
    });
    expect(sent.status).toBe("SUBMITTING");
    expect(sent.warnings).toContain("ISSUED_LATE");
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
    // F-16: cảnh báo chưa xác nhận → 409 kèm danh sách; xác nhận rồi thì gửi được
    const unacknowledged = fixed.warnings.filter((w) => w !== "EARLIER_INVOICE_PENDING");
    if (unacknowledged.length > 0) {
      const outOfDate = await errorOf(
        issueEInvoice({ id: fixed.id, version: fixed.version, lateReason: "Trễ" }),
      );
      expect(outOfDate).toMatchObject({ code: "EINVOICE_DRAFT_OUT_OF_DATE" });
      expect(outOfDate.details).toMatchObject({ warnings: unacknowledged });
    }
    expect(
      (
        await issueEInvoice({
          id: fixed.id,
          version: fixed.version,
          acknowledgedWarnings: fixed.warnings,
          lateReason: "Trễ",
        })
      ).status,
    ).toBe("SUBMITTING");
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

describe("WF-05 additions (Q-8, BE-11, BO-04, BO-09, BO-10)", () => {
  it("BO-09: an issued invoice's signature is checked; an XML handed in too", async () => {
    const draft = await getEInvoice("EINV-0001");
    await issueEInvoice({ id: draft.id, version: draft.version, lateReason: "Trễ" });
    await reconcileEInvoice({ id: draft.id });
    expect((await getSignature(draft.id)).status).toBe("VALID");
    const checked = await checkSignature(new File(["<x/>"], "hd.xml", { type: "text/xml" }));
    expect(checked).toMatchObject({ status: "SHA1_UNCHECKED", valid: false });
    expect(await errorOf(getSignature("EINV-0002"))).toMatchObject({
      code: "EINVOICE_NOT_ISSUED",
    });
  });

  it("Q-8: a SUBMITTING invoice is recorded as issued from the provider's portal", async () => {
    const draft = await getEInvoice("EINV-0001");
    const sent = await issueEInvoice({ id: draft.id, version: draft.version, lateReason: "Trễ" });
    const recorded = await recordPortalResult({
      id: sent.id,
      version: sent.version,
      outcome: "ISSUED",
      invoiceNumber: 77,
      note: "Cổng SePay có số 77",
    });
    expect(recorded).toMatchObject({
      status: "ISSUED",
      invoiceNumber: 77,
      issuedVia: "PORTAL_RECORD",
    });
  });

  it("Q-8 (F-14): a system reduction is voided only as unsendable", async () => {
    const reduction = (await listEInvoices({ size: 100 })).items.find(
      (row) => row.correctionBasis === "DELIVERY_FAILED" && row.status === "DRAFT",
    );
    expect(reduction).toBeDefined();
    if (!reduction) return;
    const detail = await getEInvoice(reduction.id);
    expect(
      await errorOf(voidDraft({ id: detail.id, version: detail.version, reason: "x" })),
    ).toMatchObject({ code: "EINVOICE_CORRECTION_NOT_APPLICABLE" });
    const voided = await voidDraft({
      id: detail.id,
      version: detail.version,
      reason: "NCC cũ không dùng được",
      reasonCode: "UNSENDABLE_REVERSAL",
    });
    expect(voided.status).toBe("VOIDED_DRAFT");
  });

  it("NĐ 254 (G3): the issue deadline is the end of the invoice's own date, Vietnam time", async () => {
    const draft = await getEInvoice("EINV-0001");
    expect(draft.issueDate).toBe("2026-11-10");
    expect(draft.issueDueAt).toBe("2026-11-10T16:59:59Z");
  });

  it("Q-10: the list filters invoices issued late", async () => {
    const draft = await getEInvoice("EINV-0001");
    await issueEInvoice({ id: draft.id, version: draft.version, lateReason: "Trễ" });
    const late = await listEInvoices({ warning: "ISSUED_LATE" });
    expect(late.items.map((row) => row.id)).toEqual(["EINV-0001"]);
  });

  it("BO-04: the sandbox has no account to store; BO-10: the sandbox takes no template code", async () => {
    actAs("USER-ADMIN-01");
    expect(
      await errorOf(
        storeProviderAccount({
          provider: "SANDBOX",
          version: 0,
          environment: "SANDBOX",
          username: "u",
          secret: undefined,
        }),
      ),
    ).toMatchObject({ status: 400, fieldErrors: { provider: expect.any(String) } });
    expect(
      await errorOf(
        selectSeries({
          provider: "SANDBOX",
          templateCode: "1",
          symbol: "C26TAB",
          year: 2026,
          providerTemplateCode: "1/001",
        }),
      ),
    ).toMatchObject({ fieldErrors: { providerTemplateCode: expect.any(String) } });
  });
});

describe("audit r3 EINV-2: an error's correction made on the portal (basis ERROR)", () => {
  const portal = (over: Partial<Parameters<typeof recordExternalReduction>[0]> = {}) =>
    recordExternalReduction({
      id: "EINV-0013",
      symbol: "C26TAA",
      templateCode: "1",
      invoiceNumber: 61,
      issueDate: "2026-11-20",
      pdf: new File(["%PDF"], "g.pdf", { type: "application/pdf" }),
      xml: new File(["<HDon/>"], "g.xml", { type: "text/xml" }),
      note: "Điều chỉnh sai sót làm trên cổng",
      basis: "ERROR",
      voidedAdjustmentId: "EINV-0014",
      ...over,
    });

  it("offers the voided draft as BE `externalReductionErrors` (grandTotal below zero) and ERROR in the bases", async () => {
    const original = await getEInvoice("EINV-0013");
    expect(original.externalReductionAllowed).toBe(true);
    expect(original.externalReductionBases).toEqual(["ERROR"]);
    expect(original.externalReductionErrors).toEqual([
      {
        voidedAdjustmentId: "EINV-0014",
        code: "HDDT-0014",
        reason: "Ghi thừa 2 thùng so với số giao",
        grandTotal: -1_684_800,
      },
    ]);
  });

  it("records the draft's own lines and agreement once; then the invoice offers it no more (409 again)", async () => {
    const recorded = await portal();
    expect(recorded).toMatchObject({
      type: "ADJUSTMENT",
      status: "ISSUED",
      issuedVia: "PORTAL_RECORD",
      correctionBasis: "ERROR",
      originalEInvoiceId: "EINV-0013",
      agreement: { number: "TT-0019/2026" },
    });
    expect(recorded.lines.map((line) => line.quantity)).toEqual([-2000]);
    const after = await getEInvoice("EINV-0013");
    expect(after.externalReductionErrors).toEqual([]);
    expect(after.externalReductionAllowed).toBe(false);
    expect(await errorOf(portal())).toMatchObject({
      status: 409,
      code: "EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE",
    });
  });

  it("ERROR needs the voided draft (400); a draft not offered is 409; a date before the original is 400", async () => {
    expect(await errorOf(portal({ voidedAdjustmentId: undefined }))).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
    expect(await errorOf(portal({ voidedAdjustmentId: "EINV-0012" }))).toMatchObject({
      status: 409,
      code: "EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE",
    });
    expect(await errorOf(portal({ issueDate: "2026-11-01" }))).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
    // Không có hoá đơn sai sót nào để ghi trên hoá đơn đã sạch → nút không có, gửi vẫn 409
    expect(await errorOf(portal({ id: "EINV-0007" }))).toMatchObject({ status: 409 });
  });
});
