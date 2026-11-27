/** Selector thuần của hoá đơn điện tử (docs 21). */

import {
  DATES_ONLY_TODAY_PROVIDERS,
  DEPLOYMENT_ACCOUNT_PROVIDERS,
  EINVOICE_LATE_WARNING,
  EINVOICE_PROVIDER_CODES,
  EINVOICE_STATUS_BY_API,
  EINVOICE_SYSTEM_REJECTION_CODES,
} from "@/constants/einvoice";
import {
  EINVOICE_ISSUE_CHECK_LABELS,
  EINVOICE_LABELS,
  WITHDRAWAL_BLOCK_LABELS,
  lateIssueLabel,
} from "@/constants/labels-einvoice";
import { formatDate, formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { statusLabelVi } from "@/lib/status-map";

import type { EInvoiceStatusRead } from "@/constants/einvoice";
import type { EInvoice, EInvoiceListItem, EInvoiceProvider } from "./types";

export function einvoiceStatusLabel(status: EInvoiceStatusRead): string {
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

/**
 * Số đơn cho chip lọc theo đơn: lấy từ các dòng đã tải (BE kèm `orderNumber`) — không tra thêm, không mảnh UUID.
 * `null` khi chưa có dòng nào của đơn đó (UI hiện nhãn trung tính).
 */
export function orderNumberOnRows(
  rows: readonly Pick<EInvoiceListItem, "orderId" | "orderNumber">[] | undefined,
  orderId: string,
): string | null {
  return rows?.find((row) => row.orderId === orderId && row.orderNumber)?.orderNumber ?? null;
}

/**
 * Ký hiệu-số của hoá đơn gốc (#286 `originalEInvoiceSymbol` / `originalEInvoiceNumber`), cùng cách đệm số như
 * `invoiceReference`. `null` khi BE chưa kèm (gốc chưa có số / BE cũ) — UI hiện nhãn trung tính, không UUID.
 */
export function originalInvoiceReference(
  invoice: Pick<EInvoice, "originalEInvoiceSymbol" | "originalEInvoiceNumber">,
): string | null {
  const { originalEInvoiceSymbol: symbol, originalEInvoiceNumber: number } = invoice;
  if (!symbol || number == null) return null;
  return `${symbol}-${String(number).padStart(7, "0")}`;
}

/**
 * Câu tiếng Việt của một cảnh báo BE — cảnh báo lưu trên hoá đơn, hoặc điều BE kiểm lại lúc phát hành tay
 * (`EINVOICE_ISSUE_CHECKS`, F-16); mã lạ → câu chung (BE có thể thêm loại mới).
 */
export function warningLabel(code: string): string {
  return (
    EINVOICE_LABELS.warnings[code as keyof typeof EINVOICE_LABELS.warnings] ??
    EINVOICE_ISSUE_CHECK_LABELS[code as keyof typeof EINVOICE_ISSUE_CHECK_LABELS] ??
    EINVOICE_LABELS.warnings.unknown
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Số ngày lập trễ = ngày hoá đơn − ngày giao (WF-05 Q-10). Cần `deliveredOn` của BE (hợp đồng giả định, xem
 * `schemas.ts`); vắng → null (nhãn "Lập trễ" không số ngày).
 */
export function lateIssueDays(
  invoice: Partial<Pick<EInvoice, "issueDate" | "deliveredOn">>,
): number | null {
  if (!invoice.issueDate || !invoice.deliveredOn) return null;
  const days = Math.round(
    (Date.parse(invoice.issueDate.slice(0, 10)) - Date.parse(invoice.deliveredOn.slice(0, 10))) /
      DAY_MS,
  );
  return Number.isFinite(days) && days > 0 ? days : null;
}

/** Hoá đơn đã phát hành sau ngày giao (BE thêm `ISSUED_LATE` lúc gửi, WF-05 Q-10) → nhãn "Lập trễ N ngày". */
export function lateIssueBadge(
  invoice: Pick<EInvoiceListItem, "warnings"> &
    Partial<Pick<EInvoice, "issueDate" | "deliveredOn">>,
): string | null {
  return invoice.warnings.includes(EINVOICE_LATE_WARNING)
    ? lateIssueLabel(lateIssueDays(invoice))
    : null;
}

/**
 * Gợi ý trước khi phát hành tay: nháp này sẽ thành "lập trễ" → hộp xác nhận đòi lý do ngay (WF-05 Q-10, §1.5 bước 6).
 * Đúng điều BE đòi (`EInvoice.lateIfIssuedOn`, 400 EINVOICE_LATE_ISSUE_REASON_REQUIRED; audit r2 contract L12):
 * - chỉ hoá đơn GỐC — điều chỉnh / thay thế không bao giờ bị đòi lý do;
 * - chỉ dưới NCC chỉ nhận ngày lập hôm nay (`DATES_ONLY_TODAY_PROVIDERS`, SePay) — NCC khác ghi đúng ngày giao. NCC của
 *   nháp chưa biết (BE chỉ ghi NCC lúc gửi) → vẫn hỏi lý do: SePay là NCC triển khai, và lý do thừa không hại;
 * - ngày giao (`deliveredOn`, nháp gốc chưa gửi: ngày lập) trước hôm nay, giờ Việt Nam.
 * Chỉ là gợi ý: BE quyết; BE đòi mà FE không đoán ra thì ô lý do hiện sau 400.
 */
export function issueLooksLate(
  invoice: Pick<EInvoice, "type" | "issueDate"> &
    Partial<Pick<EInvoice, "deliveredOn" | "provider">>,
  now: Date = new Date(),
): boolean {
  if (invoice.type !== "ORIGINAL") return false;
  if (invoice.provider && !DATES_ONLY_TODAY_PROVIDERS.includes(invoice.provider)) return false;
  const delivered = invoice.deliveredOn ?? invoice.issueDate;
  if (!delivered) return false;
  return delivered.slice(0, 10) < toLocalIsoDate(now.toISOString());
}

/**
 * Vì sao hoá đơn đang gửi chưa có nút "Rút" (audit r2 H-2, BE `withdrawalBlockedBy`) — câu hiện thay cho nút; null khi rút
 * được, khi hoá đơn không đang gửi, hoặc BE cũ không gửi lý do. TOO_RECENT kèm "Rút được từ <giờ>" (`withdrawableFrom`).
 */
export function withdrawalBlockedText(
  invoice: Pick<EInvoice, "status"> &
    Partial<Pick<EInvoice, "withdrawable" | "withdrawalBlockedBy" | "withdrawableFrom">>,
): string | null {
  if (invoice.status !== "SUBMITTING" || invoice.withdrawable === true) return null;
  const blocked = invoice.withdrawalBlockedBy;
  if (!blocked || blocked === "NOT_AT_PROVIDER") return null;
  const base = WITHDRAWAL_BLOCK_LABELS[blocked];
  return blocked === "TOO_RECENT" && invoice.withdrawableFrom
    ? `${base} Rút được từ ${formatDateTime(invoice.withdrawableFrom)}.`
    : base;
}

/**
 * Dòng tra lại giao dịch cũ sau khi rút / sau khi cơ quan thuế từ chối (audit r3 EINV-3, QĐ HĐ-1 bước 3: "sau khi rút có
 * dòng 'đang tra lại tới ngày …'"): NCC vẫn phát hành (`watchFoundAt`) → cảnh báo trùng; còn trong hạn → "đang tra lại tới
 * ngày"; đã qua hạn → đã tra xong. `tone` "warning" chỉ khi thấy NCC phát hành. Null khi BE không gửi mốc (không có giao
 * dịch nào bị buông, hoặc BE cũ).
 *
 * Audit r3 CF-9: một hoá đơn có thể có nhiều lượt tra lại (rút giao dịch A, mở lại, gửi B rồi B cũng bị buông). BE gửi
 * `watchFoundAt` khi BẤT KỲ lượt nào thấy NCC vẫn phát hành, kể cả khi `watchUntil` là của lượt mới hơn còn đang tra — nên
 * cảnh báo trùng luôn thắng dòng "đang tra lại tới ngày", dù hai mốc đến từ hai lượt khác nhau.
 */
export function transactionWatchText(
  invoice: Partial<Pick<EInvoice, "watchUntil" | "watchFoundAt">>,
  now: Date = new Date(),
): { text: string; tone: "info" | "warning" } | null {
  if (invoice.watchFoundAt)
    return {
      text: EINVOICE_LABELS.watch.found(formatDateTime(invoice.watchFoundAt)),
      tone: "warning",
    };
  if (!invoice.watchUntil) return null;
  const until = Date.parse(invoice.watchUntil);
  if (Number.isNaN(until)) return null;
  const day = formatDate(invoice.watchUntil);
  return {
    text:
      until > now.getTime() ? EINVOICE_LABELS.watch.until(day) : EINVOICE_LABELS.watch.ended(day),
    tone: "info",
  };
}

/** Câu tiếng Việt cho từng cảnh báo BE; cảnh báo lạ → câu chung (BE có thể thêm loại mới). */
export function warningMessages(
  invoice: Pick<EInvoice, "warnings" | "earlierPendingInvoice"> &
    Partial<Pick<EInvoice, "issueDate" | "deliveredOn">>,
): string[] {
  return invoice.warnings.map((code) => {
    if (code === "EARLIER_INVOICE_PENDING" && invoice.earlierPendingInvoice)
      return `${EINVOICE_LABELS.warnings.EARLIER_INVOICE_PENDING} (${invoice.earlierPendingInvoice})`;
    if (code === EINVOICE_LATE_WARNING)
      return `${lateIssueLabel(lateIssueDays(invoice))}: ${EINVOICE_LABELS.warnings.ISSUED_LATE}`;
    return warningLabel(code);
  });
}

/**
 * Câu giải thích hoá đơn REJECTED: mã hệ thống tự ghi (rút khỏi NCC, NCC không giữ hoá đơn) có câu riêng;
 * mã của NCC → "Nhà cung cấp từ chối (mã)". Kèm `rejectionMessage` (với mã rút: điều Kế toán đã kiểm tra).
 */
export function rejectionText(
  invoice: Pick<EInvoice, "rejectionCode" | "rejectionMessage">,
): string {
  const code = invoice.rejectionCode;
  const system = EINVOICE_SYSTEM_REJECTION_CODES.find((value) => value === code);
  const head = system
    ? EINVOICE_LABELS.rejections[system]
    : `Nhà cung cấp từ chối${code ? ` (${code})` : ""}`;
  return `${head}: ${invoice.rejectionMessage ?? "không nêu lý do"}.`;
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

/** Cách NCC lấy tài khoản (BO-04): sandbox không có; NCC đọc từ biến môi trường máy chủ (SePay); NCC lưu ở màn cấu hình. */
export type AccountSource = "none" | "deployment" | "stored";

/**
 * Cờ BE `accountInDeployment` (WF-05 F-11); BE cũ chưa gửi cờ → bảng dự phòng `DEPLOYMENT_ACCOUNT_PROVIDERS`. BE
 * `storeAccount` từ chối (400) cả sandbox lẫn NCC dùng tài khoản của máy chủ, nên form tài khoản chỉ có cho "stored".
 */
export function accountSource(
  provider: Pick<EInvoiceProvider, "provider"> &
    Partial<Pick<EInvoiceProvider, "accountInDeployment">>,
): AccountSource {
  if (provider.provider === EINVOICE_PROVIDER_CODES.sandbox) return "none";
  const inDeployment =
    provider.accountInDeployment ?? DEPLOYMENT_ACCOUNT_PROVIDERS.includes(provider.provider);
  return inDeployment ? "deployment" : "stored";
}
