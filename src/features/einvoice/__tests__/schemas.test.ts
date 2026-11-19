import { describe, expect, it } from "vitest";

import { EINVOICE_UNKNOWN } from "@/constants/einvoice";
import { CORRECTION_BASIS_LABELS } from "@/constants/labels-einvoice";

import { detailJson, listItemJson } from "../__fixtures__/screen";
import { einvoiceDtoSchema, einvoiceListItemDtoSchema, errorNoticeDtoSchema } from "../schemas";

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
