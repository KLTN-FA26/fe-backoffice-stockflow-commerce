"use client";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";

import type { CreditPosition, SalesContact } from "@/features/customer/types";

/** Nhãn của hai cột phụ (audit bo-29). */
export const LIST_EXTRA_COPY = {
  creditHeader: "Hạn mức / dư nợ",
  salesHeader: "Sale liên hệ gần nhất",
  noCredit: "Không bán trả sau",
  exposure: "Dư nợ",
  overdue: "Quá hạn",
  salesLeft: "(đã nghỉ)",
  noSales: "Chưa gửi chứng từ",
  source: { QUOTE: "Báo giá", CONTRACT: "Hợp đồng" } as Record<string, string>,
} as const;

/**
 * Hạn mức (dòng đầu), dư nợ phần trả sau giao (dòng dưới), phần quá hạn màu đỏ khi có. Khách không bán trả sau vẫn hiện
 * dư nợ / quá hạn nếu còn (phí huỷ chưa trả, đợt cũ).
 */
export function CreditPositionCell({ position }: { position: CreditPosition | undefined }) {
  if (!position) return <EmptyCell />;
  const { creditLimit, exposure, currency, hasOverdue, overdueAmount } = position;
  return (
    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
      {creditLimit != null ? (
        <span className={CELL.number}>{formatMoney(creditLimit, currency)}</span>
      ) : (
        <span className={CELL.sub}>{LIST_EXTRA_COPY.noCredit}</span>
      )}
      {(creditLimit != null || exposure > 0) && (
        <span className={CELL.sub}>
          {LIST_EXTRA_COPY.exposure} {formatMoney(exposure, currency)}
        </span>
      )}
      {hasOverdue && (overdueAmount ?? 0) > 0 && (
        <span className="text-danger text-xs font-medium tabular-nums">
          {LIST_EXTRA_COPY.overdue} {formatMoney(overdueAmount ?? 0, currency)}
        </span>
      )}
    </div>
  );
}

/**
 * Người đã gửi báo giá / hợp đồng gần nhất cho khách — không phải người phụ trách khách (chưa có trường đó). Tài khoản đã
 * khoá thì thêm "(đã nghỉ)"; rê chuột xem chứng từ và ngày.
 */
export function SalesContactCell({ contact }: { contact: SalesContact | undefined }) {
  if (!contact) return <span className={CELL.sub}>{LIST_EXTRA_COPY.noSales}</span>;
  const kind = LIST_EXTRA_COPY.source[contact.source] ?? "Chứng từ";
  const title = [
    contact.documentNumber ? `${kind} ${contact.documentNumber}` : kind,
    contact.at ? formatDate(contact.at) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className={CELL.text} title={title}>
      {contact.salesName ?? "—"}
      {!contact.salesActive && <span className={CELL.sub}> {LIST_EXTRA_COPY.salesLeft}</span>}
    </span>
  );
}
