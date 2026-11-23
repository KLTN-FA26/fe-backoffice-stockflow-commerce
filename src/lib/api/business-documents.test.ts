import { describe, expect, it } from "vitest";

import { BUSINESS_DOCUMENTS } from "@/constants/labels-business-documents";

import { BUSINESS_DOCUMENT_PATHS as P, businessDocumentErrorMessage } from "./business-documents";
import { ApiError } from "./error";
import { resolveMockRoute } from "./mock-adapter";
import {
  mockPdfDisposition,
  registerBusinessDocumentMockRoutes,
} from "./mock-routes-business-documents";
import { fileNameFromDisposition } from "./file-download";

const err = (status: number, code: string, message = code) => new ApiError(status, code, message);

describe("BUSINESS_DOCUMENT_PATHS — đường BE feat/business-documents (endpoints.md #1–#7)", () => {
  it("khớp từng endpoint staff", () => {
    expect(P.contractAppendix("o 1")).toBe("/orders/o%201/contract/appendix");
    expect(P.contractLiquidation("o1")).toBe("/orders/o1/contract/liquidation");
    expect(P.returnReceiptVoucher("r1")).toBe("/goods-receipts/returns/r1/voucher");
    expect(P.refundConfirmation("rec1")).toBe("/refunds/records/rec1/confirmation");
    expect(P.paymentConfirmation("i1", "p1")).toBe("/installments/i1/receipts/p1/confirmation");
    expect(P.debtReconciliation("c1", "2026-11-01", "2026-11-23")).toBe(
      "/installments/debt-reconciliation?customerId=c1&from=2026-11-01&to=2026-11-23",
    );
    expect(P.einvoiceAgreementDraft("adj1")).toBe("/einvoices/adj1/agreement/draft");
  });

  it("quyền của nút = quyền seed của endpoint", () => {
    expect(BUSINESS_DOCUMENTS.contractAppendix.permission).toBe("sales-contracts:READ");
    expect(BUSINESS_DOCUMENTS.contractLiquidation.permission).toBe("sales-contracts:READ");
    expect(BUSINESS_DOCUMENTS.returnReceiptVoucher.permission).toBe(
      "procurement-goods-receipts:READ",
    );
    expect(BUSINESS_DOCUMENTS.refundConfirmation.permission).toBe("payment-refunds:READ");
    expect(BUSINESS_DOCUMENTS.paymentConfirmation.permission).toBe("payment-installments:READ");
    expect(BUSINESS_DOCUMENTS.debtReconciliation.permission).toBe("payment-installments:READ");
    expect(BUSINESS_DOCUMENTS.einvoiceAgreementDraft.permission).toBe("einvoices:READ");
  });
});

describe("businessDocumentErrorMessage — mọi lỗi ra câu tiếng Việt", () => {
  it("403 / 404 chung theo tên giấy tờ", () => {
    expect(businessDocumentErrorMessage("refundConfirmation", err(403, "FORBIDDEN"))).toBe(
      "Bạn không có quyền tải phiếu hoàn tiền.",
    );
    expect(businessDocumentErrorMessage("contractLiquidation", err(404, "NOT_FOUND"))).toBe(
      "Không tìm thấy biên bản thanh lý hợp đồng.",
    );
  });

  it("mã riêng của endpoint thắng câu chung", () => {
    expect(businessDocumentErrorMessage("contractAppendix", err(404, "NOT_FOUND"))).toMatch(
      /Chưa có phụ lục/,
    );
    expect(
      businessDocumentErrorMessage("returnReceiptVoucher", err(409, "INVALID_RECEIPT_TRANSITION")),
    ).toMatch(/chưa được xác nhận/);
    expect(businessDocumentErrorMessage("returnReceiptVoucher", err(403, "FORBIDDEN"))).toMatch(
      /kho bạn không được phân công/,
    );
    expect(
      businessDocumentErrorMessage("paymentConfirmation", err(404, "PAYMENT_RECEIPT_NOT_FOUND")),
    ).toMatch(/đã bị huỷ/);
    expect(
      businessDocumentErrorMessage(
        "einvoiceAgreementDraft",
        err(409, "EINVOICE_CORRECTION_NOT_APPLICABLE"),
      ),
    ).toMatch(/không cần biên bản/);
  });

  it("owner 23/11: biên bản thanh lý bị từ chối khi “Còn lại” ≠ 0 — câu nói rõ lý do", () => {
    expect(
      businessDocumentErrorMessage(
        "contractLiquidation",
        err(409, "SALES_CONTRACT_STATUS_INVALID"),
      ),
    ).toMatch(/“Còn lại” chưa về 0/);
  });

  it("mã lạ: câu tiếng Việt BE kèm, không có thì câu dự phòng", () => {
    expect(
      businessDocumentErrorMessage("refundConfirmation", err(409, "SOMETHING_NEW", "Câu của BE")),
    ).toBe("Câu của BE");
    expect(businessDocumentErrorMessage("refundConfirmation", new Error("x"))).toBe(
      "Chưa tạo được phiếu hoàn tiền. Vui lòng thử lại sau.",
    );
  });
});

describe("mock giấy tờ — header như BE PdfDownload", () => {
  it("tên tiếng Việt đọc lại được từ header mock", () => {
    const name = "Biên bản đối chiếu công nợ BBDCCN-20261123.pdf";
    expect(fileNameFromDisposition(mockPdfDisposition(name))).toBe(name);
  });

  it("đăng ký đường đối chiếu công nợ (có query string)", () => {
    registerBusinessDocumentMockRoutes();
    const route = resolveMockRoute(
      "GET",
      "/installments/debt-reconciliation?customerId=c1&from=2026-11-10&to=2026-11-01",
    );
    expect(route).not.toBeNull();
  });
});
