/**
 * Mock giấy tờ nghiệp vụ (BE `feat/business-documents`, `documents/endpoints.md` #1–#7): PDF chữ trơn, header như BE
 * `PdfDownload` (`inline; filename="=?UTF-8?Q?...?="; filename*=UTF-8''...`) để màn đọc đúng tên tiếng Việt. Quyền kiểm
 * theo mã của endpoint; dữ kiện nghiệp vụ (đã ký chưa, phiếu đã xác nhận chưa…) không mô phỏng — nút trên màn đã chặn.
 * Đăng ký TRƯỚC module đơn / thanh toán / hoá đơn: `/installments/debt-reconciliation` phải khớp trước `/installments/:id`.
 */

import { BUSINESS_DOCUMENTS } from "@/constants/labels-business-documents";

import { registerMockRoute } from "./mock-adapter";
import { can } from "./mock-routes-payment";
import { fail, pathParams, queryOf } from "./mock-route-utils";
import { mockTextPdf } from "./mock-text-pdf";

import type { AxiosRequestConfig } from "axios";
import type { BusinessDocumentKind } from "@/constants/labels-business-documents";

/** Header như Spring `ContentDisposition.inline().filename(name, UTF_8)`: Q-encoded fallback + `filename*`. */
export function mockPdfDisposition(fileName: string): string {
  const bytes = new TextEncoder().encode(fileName);
  const q = Array.from(bytes, (byte) =>
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a)
      ? String.fromCharCode(byte)
      : `=${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
  return `inline; filename="=?UTF-8?Q?${q}?="; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function pdf(fileName: string, lines: readonly string[]) {
  return {
    status: 200,
    data: mockTextPdf(lines),
    headers: {
      "content-type": "application/pdf",
      "content-disposition": mockPdfDisposition(fileName),
      "cache-control": "private, no-store",
    },
  };
}

function route(
  kind: BusinessDocumentKind,
  path: string,
  draw: (config: AxiosRequestConfig) => ReturnType<typeof pdf> | ReturnType<typeof fail>,
): void {
  registerMockRoute("GET", path, async (config) => {
    if (!(await can(BUSINESS_DOCUMENTS[kind].permission)))
      return fail(403, "FORBIDDEN", "Forbidden");
    return draw(config);
  });
}

const tail = (id: string) => id.slice(-6).toUpperCase();

export function registerBusinessDocumentMockRoutes(): void {
  route("contractAppendix", "/orders/:id/contract/appendix", (config) => {
    const id = pathParams(config).id ?? "";
    return pdf(`Phụ lục hợp đồng PL01-HD-${tail(id)}.pdf`, [
      `Contract appendix of order ${id} (mock)`,
    ]);
  });
  route("contractLiquidation", "/orders/:id/contract/liquidation", (config) => {
    const id = pathParams(config).id ?? "";
    return pdf(`Biên bản thanh lý hợp đồng TL-HD-${tail(id)}.pdf`, [
      `Contract liquidation of order ${id} (mock)`,
    ]);
  });
  route("returnReceiptVoucher", "/goods-receipts/returns/:id/voucher", (config) => {
    const id = pathParams(config).id ?? "";
    return pdf(`Phiếu nhập kho GR-RET-${tail(id)}.pdf`, [`Goods receipt 01-VT ${id} (mock)`]);
  });
  route("refundConfirmation", "/refunds/records/:id/confirmation", (config) => {
    const id = pathParams(config).id ?? "";
    return pdf(`Phiếu hoàn tiền PHT-${tail(id)}.pdf`, [`Refund confirmation ${id} (mock)`]);
  });
  route(
    "paymentConfirmation",
    "/installments/:installmentId/receipts/:receiptId/confirmation",
    (config) => {
      const { installmentId = "", receiptId = "" } = pathParams(config);
      return pdf(`Phiếu xác nhận thanh toán XNTT-${tail(receiptId)}.pdf`, [
        `Payment confirmation ${receiptId} for installment ${installmentId} (mock)`,
      ]);
    },
  );
  route("debtReconciliation", "/installments/debt-reconciliation", (config) => {
    const q = queryOf(config);
    const from = q.get("from") ?? "";
    const to = q.get("to") ?? "";
    // BE: 400 VALIDATION_FAILED khi thiếu ngày, đến trước từ
    if (!q.get("customerId") || !from || !to || to < from)
      return fail(400, "VALIDATION_FAILED", "to is before from, or after today");
    return pdf(`Biên bản đối chiếu công nợ BBDCCN-${to.replace(/-/g, "")}.pdf`, [
      `Debt reconciliation ${from} - ${to} (mock)`,
    ]);
  });
  route("einvoiceAgreementDraft", "/einvoices/:id/agreement/draft", (config) => {
    const id = pathParams(config).id ?? "";
    return pdf(`Biên bản thỏa thuận điều chỉnh hóa đơn BBTT-${tail(id)}.pdf`, [
      `Invoice correction agreement draft ${id} (mock)`,
    ]);
  });
}
