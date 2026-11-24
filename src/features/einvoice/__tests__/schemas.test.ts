import { describe, expect, it } from "vitest";

import { EINVOICE_UNKNOWN, SIGNATURE_STATUSES } from "@/constants/einvoice";
import { CORRECTION_BASIS_LABELS, SIGNATURE_STATUS_LABELS } from "@/constants/labels-einvoice";
import { ApiError } from "@/lib/api/error";

import { detailJson, listItemJson } from "../__fixtures__/screen";
import {
  EINVOICE_ERROR_MESSAGES,
  einvoiceErrorMessage,
  portalResultErrorMessage,
  withdrawalRefusal,
} from "../errors";
import { externalReductionInputSchema, portalResultInputSchema } from "../input-schemas";
import { agreementDraftAvailable } from "../lifecycle";
import {
  einvoiceDtoSchema,
  einvoiceListItemDtoSchema,
  einvoiceProviderDtoSchema,
  errorNoticeDtoSchema,
  providerCallDtoSchema,
  signatureDtoSchema,
} from "../schemas";

describe("einvoice DTO enums are read tolerantly (BE may add values)", () => {
  it("BE PR #369: reads a correction for a failed delivery (DELIVERY_FAILED)", () => {
    const invoice = einvoiceDtoSchema.parse(
      detailJson({ type: "ADJUSTMENT", correctionBasis: "DELIVERY_FAILED" }),
    );
    expect(invoice.correctionBasis).toBe("DELIVERY_FAILED");
    expect(CORRECTION_BASIS_LABELS.DELIVERY_FAILED).toContain("Giao hàng thất bại");
  });

  it("an unknown status, type or basis becomes UNKNOWN instead of failing the page", () => {
    const invoice = einvoiceDtoSchema.parse(
      detailJson({ status: "ARCHIVED", type: "SUMMARY", correctionBasis: "PRICE_CUT" }),
    );
    expect(invoice.status).toBe(EINVOICE_UNKNOWN);
    expect(invoice.type).toBe(EINVOICE_UNKNOWN);
    expect(invoice.correctionBasis).toBe(EINVOICE_UNKNOWN);
    expect(einvoiceListItemDtoSchema.parse(listItemJson({ status: "NEW" })).status).toBe(
      EINVOICE_UNKNOWN,
    );
  });

  it("an unknown error-notice status is read too", () => {
    const notice = errorNoticeDtoSchema.parse({
      id: "n-1",
      einvoiceId: "einv-1",
      formCode: "04/SS-HDDT",
      subject: "SOMETHING_ELSE",
      reason: "x",
      status: "WITHDRAWN",
      recordedAt: "2026-11-12T03:00:00Z",
    });
    expect(notice.status).toBe(EINVOICE_UNKNOWN);
    expect(notice.subject).toBe(EINVOICE_UNKNOWN);
  });

  it("a missing or non-string status is still a contract bug", () => {
    expect(einvoiceDtoSchema.safeParse(detailJson({ status: null })).success).toBe(false);
    expect(einvoiceDtoSchema.safeParse(detailJson({ status: 3 })).success).toBe(false);
  });
});

describe("WF-05 fields are optional and tolerant (BO can merge before or after the BE)", () => {
  it("F-11: reversedAt, errorNoticeSupported, issuedVia, deliveredOn are read when sent and absent otherwise", () => {
    const old = einvoiceDtoSchema.parse(detailJson());
    expect(old.reversedAt).toBeUndefined();
    expect(old.errorNoticeSupported).toBeUndefined();
    const fresh = einvoiceDtoSchema.parse(
      detailJson({
        reversedAt: "2026-11-10T03:00:00Z",
        errorNoticeSupported: false,
        issuedVia: "SOMETHING_NEW",
        deliveredOn: "2026-11-09",
      }),
    );
    expect(fresh).toMatchObject({
      reversedAt: "2026-11-10T03:00:00Z",
      errorNoticeSupported: false,
      issuedVia: "SOMETHING_NEW",
      deliveredOn: "2026-11-09",
    });
    const row = einvoiceListItemDtoSchema.parse(
      listItemJson({ correctionBasis: "NEW_BASIS", reversedAt: null }),
    );
    expect(row.correctionBasis).toBe(EINVOICE_UNKNOWN);
  });

  it("F-11: provider capability flags are optional", () => {
    const base = {
      provider: "SEPAY_EINVOICE",
      secretSet: false,
      active: true,
      autoIssue: true,
      version: 1,
    };
    expect(einvoiceProviderDtoSchema.parse(base).accountInDeployment).toBeUndefined();
    expect(
      einvoiceProviderDtoSchema.parse({
        ...base,
        accountInDeployment: true,
        deploymentAccountReady: false,
        issuesCorrections: true,
        adjustsReplacements: false,
        sendsErrorNotices: false,
      }),
    ).toMatchObject({ accountInDeployment: true, deploymentAccountReady: false });
  });

  it("BO-09: providerReference and every signature status, an unknown one included", () => {
    expect(
      providerCallDtoSchema.parse({
        provider: "SEPAY_EINVOICE",
        operation: "SUBMIT",
        outcome: "PENDING",
        calledAt: "2026-11-08T03:00:00Z",
        durationMs: 1,
        providerReference: "create/TRK-1",
      }).providerReference,
    ).toBe("create/TRK-1");
    for (const status of [...SIGNATURE_STATUSES, "NEW_STATUS"]) {
      const parsed = signatureDtoSchema.parse({ status, valid: false });
      expect(SIGNATURE_STATUS_LABELS[parsed.status]).toBeTruthy();
    }
    expect(signatureDtoSchema.parse({ status: "NEW", valid: false }).status).toBe(EINVOICE_UNKNOWN);
  });
});

describe("BO-10: every WF-05 error code the e-invoice screens can receive has Vietnamese text", () => {
  const codes = [
    "SECRETS_UNAVAILABLE",
    "RETURN_REQUEST_NOT_FOUND",
    "EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED",
    "EINVOICE_PORTAL_RECORD_MISMATCH",
    "EINVOICE_PORTAL_FILE_INVALID",
    "EINVOICE_REVERSAL_STILL_SENDABLE",
    "EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE",
    "EINVOICE_REVERSAL_NOT_APPLICABLE",
    "EINVOICE_DRAFT_OUT_OF_DATE",
    "EINVOICE_LATE_ISSUE_REASON_REQUIRED",
    "EINVOICE_REPLACEMENT_NOT_ADJUSTABLE",
    "EINVOICE_QUOTA_EXHAUSTED",
    "EINVOICE_WITHDRAWAL_REFUSED",
    "EINVOICE_CORRECTION_FORM_FIXED",
    "EINVOICE_NOT_IN_FORCE",
  ];
  it.each(codes)("%s", (code) => {
    expect(EINVOICE_ERROR_MESSAGES[code]).toBeTruthy();
    const message = einvoiceErrorMessage(new ApiError(409, code, "English text"));
    expect(message).toBe(EINVOICE_ERROR_MESSAGES[code]);
    expect(message).not.toContain("English text");
  });

  it("Q-9: the replacement errors point to replace-again or the portal, never “Thay thế” for a return", () => {
    expect(EINVOICE_ERROR_MESSAGES.EINVOICE_CORRECTION_FORM_FIXED).toMatch(/thay thế mới/);
    expect(EINVOICE_ERROR_MESSAGES.EINVOICE_REPLACEMENT_NOT_ADJUSTABLE).toMatch(
      /cổng nhà cung cấp/,
    );
  });

  it("F-12: a refused withdrawal reads its details; malformed details are ignored", () => {
    const error = (details: Record<string, unknown>, code = "EINVOICE_WITHDRAWAL_REFUSED") =>
      new ApiError(409, code, "x", undefined, undefined, undefined, undefined, details);
    expect(withdrawalRefusal(error({ providerState: "UNCONFIRMED" }))?.evidenceRequired).toBe(true);
    expect(
      withdrawalRefusal(error({}, "EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED"))?.evidenceRequired,
    ).toBe(true);
    expect(withdrawalRefusal(error({ providerState: 7, withdrawableFrom: 3 }))).toMatchObject({
      providerState: null,
      withdrawableFrom: null,
      evidenceRequired: false,
    });
    expect(einvoiceErrorMessage(error({ providerState: "WHO_KNOWS" }))).toBe(
      EINVOICE_ERROR_MESSAGES.EINVOICE_WITHDRAWAL_REFUSED,
    );
    expect(withdrawalRefusal(new ApiError(409, "OTHER", "x"))).toBeNull();
  });

  it("F-16: an out-of-date draft lists the new warnings in words", () => {
    const message = einvoiceErrorMessage(
      new ApiError(
        409,
        "EINVOICE_DRAFT_OUT_OF_DATE",
        "x",
        undefined,
        undefined,
        undefined,
        undefined,
        {
          warnings: ["TAX_CLASS_UNKNOWN", "SOMETHING_NEW"],
        },
      ),
    );
    expect(message).toMatch(/mức cao nhất 10%/);
    expect(message).toMatch(/cảnh báo mới/);
  });
});

describe("externalReductionInputSchema — BE G3 requires the XML and takes basis + returnRequestId", () => {
  const valid = {
    symbol: "c26taa",
    templateCode: "1",
    invoiceNumber: "12",
    issueDate: "2026-11-01",
    pdf: new File(["%PDF"], "giam.pdf", { type: "application/pdf" }),
    xml: new File(["<x/>"], "giam.xml", { type: "text/xml" }),
    note: "Giảm trên cổng",
    basis: "DELIVERY_FAILED",
  };

  it("an XML is required now", () => {
    const parsed = externalReductionInputSchema.safeParse({ ...valid, xml: null });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Chọn tệp XML của hoá đơn giảm");
  });

  it("RETURN needs the return request; DELIVERY_FAILED drops a stray one", () => {
    expect(externalReductionInputSchema.safeParse({ ...valid, basis: "RETURN" }).success).toBe(
      false,
    );
    const ret = externalReductionInputSchema.parse({
      ...valid,
      basis: "RETURN",
      returnRequestId: "rr-1",
    });
    expect(ret).toMatchObject({ basis: "RETURN", returnRequestId: "rr-1", symbol: "C26TAA" });
    expect(
      externalReductionInputSchema.parse({ ...valid, returnRequestId: "rr-1" }).returnRequestId,
    ).toBeUndefined();
  });
});

describe("agreementDraftAvailable — documents #7 only on a live correction", () => {
  it.each([
    ["ADJUSTMENT", "DRAFT", true],
    ["REPLACEMENT", "ISSUED", true],
    ["ADJUSTMENT", "VOIDED_DRAFT", false],
    ["ORIGINAL", "ISSUED", false],
  ] as const)("%s %s → %s", (type, status, expected) => {
    expect(agreementDraftAvailable({ type, status })).toBe(expected);
  });
});

describe("portal result (audit r2 M-2, Low 10)", () => {
  const files = {
    xml: new File(["<HDon/>"], "hd.xml", { type: "text/xml" }),
    pdf: new File(["%PDF"], "hd.pdf", { type: "application/pdf" }),
  };

  it("ISSUED needs number, tax authority code, look-up code, XML and PDF — one issue per missing field", () => {
    const parsed = portalResultInputSchema.safeParse({
      outcome: "ISSUED",
      invoiceNumber: "",
      taxAuthorityCode: " ",
      lookupCode: "",
      xml: null,
      pdf: null,
      note: "Đã kiểm",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toEqual([
      "invoiceNumber",
      "taxAuthorityCode",
      "lookupCode",
      "xml",
      "pdf",
    ]);
    const ok = portalResultInputSchema.parse({
      outcome: "ISSUED",
      invoiceNumber: "77",
      taxAuthorityCode: "M1-26",
      lookupCode: "TC77",
      ...files,
      note: "Đã kiểm",
    });
    expect(ok).toMatchObject({ invoiceNumber: 77, taxAuthorityCode: "M1-26", lookupCode: "TC77" });
  });

  it("a refusal drops whatever was typed for ISSUED", () => {
    expect(
      portalResultInputSchema.parse({
        outcome: "REFUSED_BY_TAX_AUTHORITY",
        invoiceNumber: "77",
        taxAuthorityCode: "M1-26",
        lookupCode: "",
        ...files,
        note: "CQT từ chối",
      }),
    ).toEqual({
      outcome: "REFUSED_BY_TAX_AUTHORITY",
      invoiceNumber: undefined,
      taxAuthorityCode: undefined,
      lookupCode: undefined,
      xml: undefined,
      pdf: undefined,
      note: "CQT từ chối",
    });
  });

  it("the portal dialog words the shared codes for itself, not for a withdrawal", () => {
    const busy = portalResultErrorMessage(
      new ApiError(409, "EINVOICE_WITHDRAWAL_REFUSED", "x"),
      "ISSUED",
    );
    expect(busy).toMatch(/đang hỏi nhà cung cấp/);
    expect(busy).not.toBe(EINVOICE_ERROR_MESSAGES.EINVOICE_WITHDRAWAL_REFUSED);
    const early = portalResultErrorMessage(
      new ApiError(
        409,
        "EINVOICE_WITHDRAWAL_REFUSED",
        "x",
        undefined,
        undefined,
        undefined,
        undefined,
        {
          withdrawableFrom: "2026-11-20T03:00:00Z",
        },
      ),
      "REFUSED_BY_TAX_AUTHORITY",
    );
    expect(early).toMatch(/Ghi được từ/);
    expect(
      portalResultErrorMessage(new ApiError(409, "EINVOICE_PORTAL_RECORD_MISMATCH", "x"), "ISSUED"),
    ).toMatch(/số \/ ký hiệu đã nhập/);
    expect(
      portalResultErrorMessage(
        new ApiError(409, "EINVOICE_PORTAL_RECORD_MISMATCH", "x"),
        "REFUSED_BY_TAX_AUTHORITY",
      ),
    ).toMatch(/đã phát hành hoặc đang xử lý/);
  });

  it("audit r2 Low 13: seller profile, customer and storage codes have their own sentence", () => {
    for (const code of ["SELLER_PROFILE_UNAVAILABLE", "CUSTOMER_NOT_FOUND", "STORAGE_ERROR"]) {
      expect(EINVOICE_ERROR_MESSAGES).toHaveProperty(code);
      expect(einvoiceErrorMessage(new ApiError(409, code, "English"))).not.toMatch(/English/);
    }
    // withdraw refusal: the provider says ISSUED / REJECTED — said in Vietnamese, not dropped
    const refusal = einvoiceErrorMessage(
      new ApiError(
        409,
        "EINVOICE_WITHDRAWAL_REFUSED",
        "x",
        undefined,
        undefined,
        undefined,
        undefined,
        {
          providerState: "ISSUED",
        },
      ),
    );
    expect(refusal).toMatch(/đã phát hành — không rút/);
  });
});
