/** Selector thuần của hoá đơn điện tử (docs 21). */

import { EINVOICE_STATUS_BY_API } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { statusLabelVi } from "@/lib/status-map";

import type { EInvoiceStatus } from "@/constants/einvoice";
import type { EInvoice, EInvoiceListItem } from "./types";

export function einvoiceStatusLabel(status: EInvoiceStatus): string {
  const display = EINVOICE_STATUS_BY_API[status];
  return statusLabelVi(display, "invoice") ?? display;
}

/** "1C26TAA-0000123" — mẫu số + ký hiệu + số; chưa phát hành → mã nội bộ. */
export function invoiceReference(
  invoice: Pick<EInvoiceListItem, "templateCode" | "symbol" | "invoiceNumber" | "code">,
): string {
  if (invoice.invoiceNumber == null || !invoice.symbol) return invoice.code;
  return `${invoice.templateCode ?? ""}${invoice.symbol}-${String(invoice.invoiceNumber).padStart(7, "0")}`;
}

/** Câu tiếng Việt cho từng cảnh báo BE; cảnh báo lạ → câu chung (BE có thể thêm loại mới). */
export function warningMessages(
  invoice: Pick<EInvoice, "warnings" | "earlierPendingInvoice">,
): string[] {
  return invoice.warnings.map((code) => {
    if (code === "EARLIER_INVOICE_PENDING" && invoice.earlierPendingInvoice)
      return `${EINVOICE_LABELS.warnings.EARLIER_INVOICE_PENDING} (${invoice.earlierPendingInvoice})`;
    return (
      EINVOICE_LABELS.warnings[code as keyof typeof EINVOICE_LABELS.warnings] ??
      EINVOICE_LABELS.warnings.unknown
    );
  });
}

/** Chờ Kế toán xử lý: nháp, bị từ chối, hoặc đang gửi mà NCC báo không biết giao dịch (docs 21 §4.1–4.2). */
export function needsAttention(
  invoice: Pick<EInvoiceListItem, "status" | "warnings" | "overdue">,
): boolean {
  return (
    invoice.status === "DRAFT" ||
    invoice.status === "REJECTED" ||
    invoice.overdue ||
    invoice.warnings.includes("UNKNOWN_TO_PROVIDER")
  );
}

/** Tổng có thuế của các hoá đơn còn hiệu lực (gốc + điều chỉnh đã phát hành). */
export function issuedTotal(
  invoices: readonly Pick<EInvoiceListItem, "status" | "grandTotal">[],
): number {
  return invoices
    .filter((invoice) => invoice.status === "ISSUED")
    .reduce((sum, invoice) => sum + invoice.grandTotal, 0);
}
