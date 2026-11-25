import { describe, expect, it } from "vitest";

import {
  EINVOICE_PERMISSIONS,
  EINVOICE_STATUSES,
  EINVOICE_UNKNOWN,
  EINVOICE_WARNINGS,
} from "@/constants/einvoice";

import type { PermissionCode } from "@/lib/auth";

import {
  allowedEInvoiceActions,
  canResendEmail,
  EINVOICE_TRANSITIONS,
  isTerminalEInvoice,
} from "../lifecycle";
import {
  einvoiceStatusLabel,
  invoiceReference,
  issueLooksLate,
  lateIssueBadge,
  needsAttention,
  rejectionText,
  warningMessages,
  withdrawalBlockedText,
} from "../selectors";

const P = EINVOICE_PERMISSIONS;
const has =
  (codes: readonly string[]) =>
  (code: PermissionCode): boolean =>
    codes.includes(code);
const ACCOUNTANT = has(Object.values(P));
const SALES_MANAGER = has([P.viewPage, P.read]);
const NOBODY = has([]);

const gate = (over: Partial<Parameters<typeof allowedEInvoiceActions>[0]> = {}) => ({
  status: "DRAFT" as const,
  type: "ORIGINAL" as const,
  warnings: [] as string[],
  agreementRequired: false,
  adjusted: false,
  hasFiles: false,
  provider: "SANDBOX" as string | null,
  correctionBasis: null as Parameters<typeof allowedEInvoiceActions>[0]["correctionBasis"],
  grandTotal: 16_848_000,
  ...over,
});

type Row = NonNullable<Parameters<typeof allowedEInvoiceActions>[2]>[number];
const row = (over: Partial<Row> = {}): Row => ({
  type: "ADJUSTMENT",
  status: "DRAFT",
  grandTotal: -1_000_000,
  correctionBasis: "RETURN",
  ...over,
});
const NO_CORRECTIONS: Row[] = [];

describe("EINVOICE_TRANSITIONS (docs 21 §5.1; BE EInvoiceStatus.next)", () => {
  it("covers every BE status (+ UNKNOWN); VOIDED_DRAFT and REPLACED are final", () => {
    expect(Object.keys(EINVOICE_TRANSITIONS).sort()).toEqual(
      [...EINVOICE_STATUSES, EINVOICE_UNKNOWN].sort(),
    );
    expect(EINVOICE_TRANSITIONS.VOIDED_DRAFT).toEqual([]);
    expect(EINVOICE_TRANSITIONS.REPLACED).toEqual([]);
    expect(isTerminalEInvoice("REPLACED")).toBe(true);
    expect(isTerminalEInvoice("ISSUED")).toBe(false);
  });

  it("BR-03: an issued invoice is never edited or voided — only replaced", () => {
    expect(EINVOICE_TRANSITIONS.ISSUED).toEqual(["REPLACED"]);
  });

  it("a rejected invoice returns to a draft before it is issued again (§4.2 step 7)", () => {
    expect(EINVOICE_TRANSITIONS.REJECTED).toEqual(["DRAFT"]);
  });
});

describe("allowedEInvoiceActions — three roles (docs 21 BR-02)", () => {
  it("accountant on a draft: revise, refresh buyer, issue, void", () => {
    expect(allowedEInvoiceActions(gate(), ACCOUNTANT)).toEqual([
      "revise",
      "refreshBuyer",
      "issue",
      "void",
    ]);
  });

  it("an error correction draft asks for the agreement first", () => {
    expect(allowedEInvoiceActions(gate({ agreementRequired: true }), ACCOUNTANT)).toContain(
      "attachAgreement",
    );
  });

  it("HĐ-3 / Q-8: a system-drawn reduction (DELIVERY_FAILED) is not voided as usual — only as unsendable", () => {
    const system = gate({ type: "ADJUSTMENT", correctionBasis: "DELIVERY_FAILED" });
    expect(allowedEInvoiceActions(system, ACCOUNTANT)).toEqual([
      "revise",
      "refreshBuyer",
      "attachAgreement",
      "issue",
      "voidUnsendable",
    ]);
    // audit r2 Low 8: BE còn đòi einvoices:APPROVE cho mã UNSENDABLE_REVERSAL — chỉ UPDATE thì không có nút
    expect(allowedEInvoiceActions(system, has([P.read, P.update]))).not.toContain("voidUnsendable");
    const manual = gate({ type: "ADJUSTMENT", correctionBasis: "RETURN" });
    expect(allowedEInvoiceActions(manual, ACCOUNTANT)).toContain("void");
    expect(allowedEInvoiceActions(manual, ACCOUNTANT)).not.toContain("attachAgreement");
  });

  it("sales manager only reads: no mutating action on any status", () => {
    for (const status of EINVOICE_STATUSES) {
      const actions = allowedEInvoiceActions(gate({ status, hasFiles: true }), SALES_MANAGER);
      expect(actions.filter((a) => a !== "downloadFiles")).toEqual([]);
    }
  });

  it("without permissions nothing at all", () => {
    expect(allowedEInvoiceActions(gate({ status: "ISSUED", hasFiles: true }), NOBODY)).toEqual([]);
  });

  it("BR-05: a submitting invoice is only looked up; resubmitted only when unknown to the provider", () => {
    expect(allowedEInvoiceActions(gate({ status: "SUBMITTING" }), ACCOUNTANT)).not.toContain(
      "resubmit",
    );
    expect(
      allowedEInvoiceActions(
        gate({ status: "SUBMITTING", warnings: ["UNKNOWN_TO_PROVIDER"], withdrawable: true }),
        ACCOUNTANT,
      ),
    ).toEqual(["reconcile", "resubmit", "withdraw", "recordPortalResult"]);
  });

  it("audit r2 H-2: withdraw only where the BE says it is taken now (`withdrawable`), to approvers only", () => {
    const submitting = gate({ status: "SUBMITTING", withdrawable: true });
    expect(allowedEInvoiceActions(submitting, ACCOUNTANT)).toEqual([
      "reconcile",
      "withdraw",
      "recordPortalResult",
    ]);
    expect(allowedEInvoiceActions(submitting, SALES_MANAGER)).toEqual([]);
    // Demo HĐ-1 bước 2: hoá đơn SePay "đang chờ" (đã phát hành, chưa có số) — "Kiểm tra lại" có, "Rút" không (Q-5)
    const held = allowedEInvoiceActions(
      gate({ status: "SUBMITTING", withdrawable: false }),
      ACCOUNTANT,
    );
    expect(held).toContain("reconcile");
    expect(held).not.toContain("withdraw");
    // BE cũ không gửi cờ → không đoán: không có nút
    expect(allowedEInvoiceActions(gate({ status: "SUBMITTING" }), ACCOUNTANT)).not.toContain(
      "withdraw",
    );
    expect(
      allowedEInvoiceActions(gate({ status: "DRAFT", withdrawable: true }), ACCOUNTANT),
    ).not.toContain("withdraw");
  });

  it("audit r2 H-2: says why withdrawing is not offered, and from when when it is only too recent", () => {
    expect(
      withdrawalBlockedText({ status: "SUBMITTING", withdrawalBlockedBy: "PROVIDER_HOLDS" }),
    ).toContain("không bao giờ rút");
    const tooRecent = withdrawalBlockedText({
      status: "SUBMITTING",
      withdrawalBlockedBy: "TOO_RECENT",
      withdrawableFrom: "2026-11-12T05:00:00Z",
    });
    expect(tooRecent).toContain("Rút được từ");
    expect(withdrawalBlockedText({ status: "SUBMITTING", withdrawalBlockedBy: "UNKNOWN" })).toBe(
      "Hiện chưa rút được hoá đơn này.",
    );
    expect(withdrawalBlockedText({ status: "SUBMITTING", withdrawable: true })).toBeNull();
    expect(
      withdrawalBlockedText({ status: "ISSUED", withdrawalBlockedBy: "NOT_AT_PROVIDER" }),
    ).toBeNull();
  });

  it("audit r2 einvoice M-1: resend e-mail on an issued or replaced invoice whose signature holds, with customer-legal-profiles:UPDATE", () => {
    const LEGAL = has(["customer-legal-profiles:UPDATE"]);
    expect(canResendEmail({ status: "ISSUED", warnings: [] }, LEGAL)).toBe(true);
    expect(canResendEmail({ status: "REPLACED", warnings: [] }, LEGAL)).toBe(true);
    expect(canResendEmail({ status: "SUBMITTING", warnings: [] }, LEGAL)).toBe(false);
    expect(canResendEmail({ status: "ISSUED", warnings: ["SIGNATURE_INVALID"] }, LEGAL)).toBe(
      false,
    );
    // Kế toán chỉ có quyền `einvoices` → không đủ: quyền gửi lại là của người ghi e-mail của khách
    expect(canResendEmail({ status: "ISSUED", warnings: [] }, has(Object.values(P)))).toBe(false);
    expect(
      allowedEInvoiceActions(
        gate({ status: "ISSUED", hasFiles: true }),
        has([...Object.values(P), "customer-legal-profiles:UPDATE"]),
        NO_CORRECTIONS,
      ),
    ).toContain("resendEmail");
  });

  it("BR-08: an adjusted invoice may be adjusted again but not replaced", () => {
    const issued = allowedEInvoiceActions(
      gate({ status: "ISSUED", hasFiles: true }),
      ACCOUNTANT,
      NO_CORRECTIONS,
    );
    expect(issued).toEqual(["downloadFiles", "adjust", "replace", "notifyError"]);
    const adjusted = allowedEInvoiceActions(
      gate({ status: "ISSUED", hasFiles: true, adjusted: true }),
      ACCOUNTANT,
      NO_CORRECTIONS,
    );
    expect(adjusted).toContain("adjust");
    expect(adjusted).not.toContain("replace");
  });

  it("a status the FE does not know yet offers nothing", () => {
    expect(allowedEInvoiceActions(gate({ status: EINVOICE_UNKNOWN }), ACCOUNTANT)).toEqual([]);
    expect(isTerminalEInvoice(EINVOICE_UNKNOWN)).toBe(true);
  });

  it("HĐ-6: the 04/SS notice only through a provider that sends it (not SePay / Viettel)", () => {
    for (const provider of ["SEPAY_EINVOICE", "VIETTEL_SINVOICE", null]) {
      const actions = allowedEInvoiceActions(
        gate({ status: "ISSUED", hasFiles: true, provider }),
        ACCOUNTANT,
        NO_CORRECTIONS,
      );
      expect(actions).not.toContain("notifyError");
      expect(actions).toContain("adjust");
    }
  });

  it("F-11: the BE's errorNoticeSupported flag wins over the provider fallback", () => {
    const issued = (over: Parameters<typeof gate>[0]) =>
      allowedEInvoiceActions(gate({ status: "ISSUED", ...over }), ACCOUNTANT, NO_CORRECTIONS);
    expect(issued({ provider: "SEPAY_EINVOICE", errorNoticeSupported: true })).toContain(
      "notifyError",
    );
    expect(issued({ provider: "SANDBOX", errorNoticeSupported: false })).not.toContain(
      "notifyError",
    );
    expect(issued({ provider: "SANDBOX", errorNoticeSupported: null })).toContain("notifyError");
  });

  it("final statuses offer no mutating action", () => {
    expect(allowedEInvoiceActions(gate({ status: "VOIDED_DRAFT" }), ACCOUNTANT)).toEqual([]);
    expect(
      allowedEInvoiceActions(gate({ status: "REPLACED", hasFiles: true }), ACCOUNTANT),
    ).toEqual(["downloadFiles"]);
  });
});

describe("allowedEInvoiceActions — corrections the BE would refuse are hidden (BO-03, Q-8, Q-9)", () => {
  const issued = (over: Parameters<typeof gate>[0] = {}, corrections?: Row[]) =>
    allowedEInvoiceActions(gate({ status: "ISSUED", ...over }), ACCOUNTANT, corrections);

  it("until the corrections are loaded, no correction action is offered", () => {
    const actions = issued({}, undefined);
    for (const action of ["adjust", "replace", "recordExternalReduction"] as const)
      expect(actions).not.toContain(action);
  });

  it("an ADJUSTMENT is never adjusted or replaced", () => {
    const actions = issued({ type: "ADJUSTMENT", correctionBasis: "ERROR" }, NO_CORRECTIONS);
    expect(actions).not.toContain("adjust");
    expect(actions).not.toContain("replace");
  });

  it("Q-9: a REPLACEMENT is not adjusted (an error → replace again); a reduction goes the portal way", () => {
    const actions = issued(
      { type: "REPLACEMENT", correctionBasis: "ERROR", externalReductionAllowed: true },
      NO_CORRECTIONS,
    );
    expect(actions).not.toContain("adjust");
    expect(actions).toContain("replace");
    expect(actions).toContain("recordExternalReduction");
  });

  it("audit r2 M-10: a replacement in force with nothing waiting to be reduced offers no portal reduction", () => {
    // Demo: hoá đơn thay thế của lần giao đã giao, không có trả hàng — BE luôn 409 NOT_APPLICABLE
    const actions = issued(
      { type: "REPLACEMENT", correctionBasis: "ERROR", externalReductionAllowed: false },
      NO_CORRECTIONS,
    );
    expect(actions).not.toContain("recordExternalReduction");
    // BE cũ không gửi cờ → không có nút
    expect(issued({ type: "REPLACEMENT" }, NO_CORRECTIONS)).not.toContain(
      "recordExternalReduction",
    );
    // Cờ không phụ thuộc danh sách điều chỉnh đã tải
    expect(issued({ externalReductionAllowed: true }, undefined)).toContain(
      "recordExternalReduction",
    );
    // Chỉ người có quyền APPROVE
    expect(
      allowedEInvoiceActions(
        gate({ status: "ISSUED", externalReductionAllowed: true }),
        SALES_MANAGER,
        NO_CORRECTIONS,
      ),
    ).not.toContain("recordExternalReduction");
  });

  it("BR-08: a live correction (even a system draft) blocks replace; a live replacement blocks adjust", () => {
    const withDraft = issued({}, [row({ correctionBasis: "DELIVERY_FAILED" })]);
    expect(withDraft).toContain("adjust");
    expect(withDraft).not.toContain("replace");
    const withReplacement = issued({}, [
      row({ type: "REPLACEMENT", grandTotal: 16_848_000, correctionBasis: "ERROR" }),
    ]);
    expect(withReplacement).not.toContain("adjust");
    expect(withReplacement).not.toContain("replace");
    const onlyVoided = issued({}, [row({ status: "VOIDED_DRAFT" })]);
    expect(onlyVoided).toContain("adjust");
    expect(onlyVoided).toContain("replace");
  });

  it("C-16 / BE-36: a reversed original, or one reduced to a net total of 0, offers neither", () => {
    const reversed = issued({ reversedAt: "2026-11-10T03:00:00Z" }, NO_CORRECTIONS);
    expect(reversed).not.toContain("adjust");
    expect(reversed).not.toContain("replace");
    const reducedToZero = issued({ adjusted: true }, [
      row({ status: "ISSUED", grandTotal: -16_848_000 }),
    ]);
    expect(reducedToZero).not.toContain("adjust");
    const partlyReduced = issued({ adjusted: true }, [
      row({ status: "ISSUED", grandTotal: -1_000_000 }),
    ]);
    expect(partlyReduced).toContain("adjust");
  });

  it("BE-11 (F-15) / fe#264: reduce for a failed delivery only when the BE allows it, on an unreduced original", () => {
    const allowed = { deliveryFailureReductionAllowed: true };
    expect(issued(allowed, NO_CORRECTIONS)).toContain("reduceFailedDelivery");
    expect(
      issued({ ...allowed, reversedAt: "2026-11-09T08:00:00Z" }, NO_CORRECTIONS),
    ).not.toContain("reduceFailedDelivery");
    expect(issued(allowed, [row({ correctionBasis: "DELIVERY_FAILED" })])).not.toContain(
      "reduceFailedDelivery",
    );
    expect(
      allowedEInvoiceActions(gate({ status: "ISSUED", ...allowed }), SALES_MANAGER, NO_CORRECTIONS),
    ).not.toContain("reduceFailedDelivery");
  });

  it("fe#264: an original issued before its delivery failed has no deliveryFailedAt — the BE flag alone shows the button", () => {
    // BE chỉ đánh dấu `deliveryFailedAt` lúc hoá đơn còn SUBMITTING; hoá đơn gốc đã ISSUED rồi mới giao thất bại không có
    // dấu đó mà BE vẫn bảo Kế toán dùng "Giảm do giao thất bại".
    expect(issued({ deliveryFailureReductionAllowed: true }, NO_CORRECTIONS)).toContain(
      "reduceFailedDelivery",
    );
  });

  it("fe#264: BE flag false or absent (old BE) → no failed-delivery reduction", () => {
    expect(issued({ deliveryFailureReductionAllowed: false }, NO_CORRECTIONS)).not.toContain(
      "reduceFailedDelivery",
    );
    expect(issued({ deliveryFailureReductionAllowed: null }, NO_CORRECTIONS)).not.toContain(
      "reduceFailedDelivery",
    );
    expect(issued({}, NO_CORRECTIONS)).not.toContain("reduceFailedDelivery");
  });

  it("Q-8 (F-13): after an unsendable reduction is voided, the portal reduction is recorded on the original — as the BE says", () => {
    const voided = row({ correctionBasis: "DELIVERY_FAILED", status: "VOIDED_DRAFT" });
    const actions = issued({ reversedAt: "2026-11-09T08:00:00Z", externalReductionAllowed: true }, [
      voided,
    ]);
    expect(actions).toContain("recordExternalReduction");
    expect(actions).not.toContain("adjust");
    // Đã ghi bản giảm: BE thôi gửi cờ
    const recorded = row({ correctionBasis: "DELIVERY_FAILED", status: "ISSUED" });
    expect(
      issued({ reversedAt: "2026-11-09T08:00:00Z", externalReductionAllowed: false }, [
        voided,
        recorded,
      ]),
    ).not.toContain("recordExternalReduction");
    expect(issued({}, NO_CORRECTIONS)).not.toContain("recordExternalReduction");
  });

  it("BE-29: a reduction voided because the delivery was corrected back (reversedAt taken back) opens no portal path", () => {
    const voided = row({ correctionBasis: "DELIVERY_FAILED", status: "VOIDED_DRAFT" });
    // DELIVERY_CORRECTED_BACK: BE gỡ reversedAt và dấu giao thất bại — hoá đơn gốc lại còn hiệu lực bình thường
    const actions = issued({}, [voided]);
    expect(actions).not.toContain("recordExternalReduction");
    expect(actions).not.toContain("reduceFailedDelivery");
    expect(actions).toContain("adjust");
  });

  it("BE-11: an original already reduced to a net 0 by returns is not offered a failed-delivery reduction", () => {
    const actions = issued({ deliveryFailureReductionAllowed: true, adjusted: true }, [
      row({ status: "ISSUED", grandTotal: -16_848_000 }),
    ]);
    expect(actions).not.toContain("reduceFailedDelivery");
  });

  it("Q-9: a REPLACEMENT whose delivery failed is never reduced through the API — only recorded from the portal", () => {
    const actions = issued(
      {
        type: "REPLACEMENT",
        deliveryFailureReductionAllowed: true,
        externalReductionAllowed: true,
      },
      NO_CORRECTIONS,
    );
    expect(actions).not.toContain("reduceFailedDelivery");
    expect(actions).not.toContain("adjust");
    expect(actions).toContain("recordExternalReduction");
  });
});

describe("selectors", () => {
  it("labels statuses in Vietnamese", () => {
    expect(einvoiceStatusLabel("ISSUED")).toBe("Đã phát hành");
    expect(einvoiceStatusLabel("VOIDED_DRAFT")).toBe("Đã huỷ nháp");
  });

  it("references an issued invoice by template, symbol and number; a draft by its code", () => {
    expect(
      invoiceReference({ templateCode: "1", symbol: "C26TAA", invoiceNumber: 42, code: "HDDT-1" }),
    ).toBe("1C26TAA-0000042");
    expect(
      invoiceReference({ templateCode: null, symbol: null, invoiceNumber: null, code: "HDDT-1" }),
    ).toBe("HDDT-1");
  });

  it("F-16: the BE's issue-time check BUYER_PROFILE_CHANGED (not a stored warning) has its own line", () => {
    const lines = warningMessages({
      warnings: ["BUYER_PROFILE_CHANGED"],
      earlierPendingInvoice: null,
    });
    expect(lines[0]).toContain("Làm mới bên mua");
    expect(lines[0]).not.toBe(warningMessages({ warnings: ["X"], earlierPendingInvoice: null })[0]);
  });

  it("explains each warning; an unknown one gets a generic line", () => {
    const lines = warningMessages({
      warnings: ["BUYER_PROFILE_INCOMPLETE", "EARLIER_INVOICE_PENDING", "SOMETHING_NEW"],
      earlierPendingInvoice: "HDDT-0007",
    });
    expect(lines[0]).not.toMatch(/BR-\d/);
    expect(lines[1]).toContain("HDDT-0007");
    expect(lines[2]).toContain("cảnh báo mới");
  });

  it("every BE warning has its own line (BE PR #369 warnings included)", () => {
    const lines = warningMessages({
      warnings: [...EINVOICE_WARNINGS],
      earlierPendingInvoice: null,
    });
    expect(lines.some((line) => line.includes("cảnh báo mới"))).toBe(false);
    const [email, outOfDate, exempt, signature] = warningMessages({
      warnings: [
        "BUYER_EMAIL_MISSING",
        "TAX_RATE_OUT_OF_DATE",
        "TAX_EXEMPT_NOT_SUPPORTED",
        "SIGNATURE_INVALID",
      ],
      earlierPendingInvoice: null,
    });
    expect(email).toContain("email");
    expect(outOfDate).toContain("Thuế suất trên nháp không còn đúng");
    expect(exempt).toContain("không chịu thuế");
    expect(signature).toContain("Chữ ký số");
  });

  it("explains a withdrawal apart from a provider's refusal", () => {
    expect(
      rejectionText({
        rejectionCode: "WITHDRAWN_NO_PROVIDER_RECORD",
        rejectionMessage: "Cổng SePay không có hoá đơn",
      }),
    ).toBe(
      "Đã rút khỏi nhà cung cấp (nhà cung cấp không có bản ghi): Cổng SePay không có hoá đơn.",
    );
    expect(rejectionText({ rejectionCode: "INVALID_SERIES", rejectionMessage: null })).toBe(
      "Nhà cung cấp từ chối (INVALID_SERIES): không nêu lý do.",
    );
    // Q-5: rút khi không xác nhận được kết quả — kèm văn bản của hỗ trợ NCC
    expect(
      rejectionText({
        rejectionCode: "WITHDRAWN_RESULT_UNCONFIRMED",
        rejectionMessage: "Phiếu hỗ trợ SP-123",
      }),
    ).toMatch(/không xác nhận được kết quả.*30 ngày.*SP-123/);
    // audit r2 Low 11: Kế toán ghi "cơ quan thuế từ chối" từ cổng — không đọc thành "Nhà cung cấp từ chối"
    expect(
      rejectionText({
        rejectionCode: "REFUSED_BY_TAX_AUTHORITY",
        rejectionMessage: "CQT trả mã lỗi trên cổng",
      }),
    ).toBe(
      "Cơ quan thuế từ chối (Kế toán ghi lại từ cổng nhà cung cấp): CQT trả mã lỗi trên cổng.",
    );
  });

  it("Q-10: an invoice issued after the delivery day reads “Lập trễ N ngày”", () => {
    expect(
      lateIssueBadge({
        warnings: ["ISSUED_LATE"],
        issueDate: "2026-11-12",
        deliveredOn: "2026-11-10",
      }),
    ).toBe("Lập trễ 2 ngày");
    expect(lateIssueBadge({ warnings: ["ISSUED_LATE"], issueDate: "2026-11-12" })).toBe("Lập trễ");
    expect(lateIssueBadge({ warnings: [], issueDate: "2026-11-12" })).toBeNull();
    expect(
      warningMessages({ warnings: ["ISSUED_LATE"], earlierPendingInvoice: null }).join(),
    ).toContain("Lập trễ");
  });

  it("Q-10: a draft whose delivery day is past asks for a late reason before it is issued", () => {
    const now = new Date("2026-11-12T03:00:00Z");
    expect(issueLooksLate({ type: "ORIGINAL", issueDate: "2026-11-11" }, now)).toBe(true);
    expect(issueLooksLate({ type: "ORIGINAL", issueDate: "2026-11-12" }, now)).toBe(false);
    expect(
      issueLooksLate({ type: "ORIGINAL", issueDate: "2026-11-12", deliveredOn: "2026-11-10" }, now),
    ).toBe(true);
    expect(
      issueLooksLate(
        { type: "ORIGINAL", issueDate: "2026-11-11", provider: "SEPAY_EINVOICE" },
        now,
      ),
    ).toBe(true);
  });

  it("audit r2 L12: the late reason is asked only where the BE asks it — originals, under a today-only provider", () => {
    const now = new Date("2026-11-12T03:00:00Z");
    // BE `lateIfIssuedOn`: điều chỉnh / thay thế không bao giờ bị đòi lý do lập trễ
    expect(issueLooksLate({ type: "ADJUSTMENT", issueDate: "2026-11-01" }, now)).toBe(false);
    expect(
      issueLooksLate(
        { type: "ADJUSTMENT", issueDate: "2026-11-12", deliveredOn: "2026-11-01" },
        now,
      ),
    ).toBe(false);
    expect(
      issueLooksLate(
        { type: "REPLACEMENT", issueDate: "2026-11-12", deliveredOn: "2026-11-01" },
        now,
      ),
    ).toBe(false);
    // NCC ghi đúng ngày giao (sandbox, Viettel) → không đòi
    for (const provider of ["SANDBOX", "VIETTEL_SINVOICE"])
      expect(issueLooksLate({ type: "ORIGINAL", issueDate: "2026-11-01", provider }, now)).toBe(
        false,
      );
  });

  it("needs the accountant: drafts, rejected, overdue or unknown to the provider", () => {
    const row = { status: "ISSUED" as const, warnings: [] as string[], overdue: false };
    expect(needsAttention(row)).toBe(false);
    expect(needsAttention({ ...row, status: "DRAFT" })).toBe(true);
    expect(
      needsAttention({ ...row, status: "SUBMITTING", warnings: ["UNKNOWN_TO_PROVIDER"] }),
    ).toBe(true);
  });
});
