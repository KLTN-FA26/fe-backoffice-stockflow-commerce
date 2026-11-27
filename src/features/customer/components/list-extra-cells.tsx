"use client";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import { SalesOwnerStateBadge } from "@/components/backoffice/SalesOwnerBadge";
import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CreditPosition, Customer, SalesContact } from "@/features/customer/types";

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
 * Người đã gửi báo giá / hợp đồng gần nhất cho khách — không phải người phụ trách khách (cột "Sale phụ trách"). Tài khoản đã
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

/**
 * Sale phụ trách lưu trên hồ sơ khách (sales-owner): tên (thêm "(đã nghỉ)" khi tài khoản không còn làm), hoặc nhãn
 * "Cần giao người phụ trách" / "Chưa có người phụ trách" khi khách chưa có người. BE chưa trả trường → "—".
 */
export function SalesOwnerCell({ customer }: { customer: Customer }) {
  const state = customer.salesOwnerState;
  if (state === "NEEDS_ASSIGNMENT" || state === "UNASSIGNED")
    return <SalesOwnerStateBadge state={state} />;
  if (!customer.salesOwnerName) return <EmptyCell />;
  return (
    <span
      className={CELL.text}
      title={customer.salesOwnerSince ? `Từ ${formatDate(customer.salesOwnerSince)}` : undefined}
    >
      {customer.salesOwnerName}
      {customer.salesOwnerActive === false && (
        <span className={CELL.sub}> {SALES_OWNER_LABELS.card.left}</span>
      )}
    </span>
  );
}

export const SALES_OWNER_COLUMN: ColumnDef<Customer> = {
  key: "salesOwner",
  header: SALES_OWNER_LABELS.list.column,
  className: "min-w-40 whitespace-normal",
  cell: (row) => <SalesOwnerCell customer={row} />,
};

/** Mã số thuế; khách cũ thiếu MST (D41, cờ `taxCodeMissing`) → nhãn nhỏ "Thiếu MST". BE cũ không gửi cờ → như trước. */
export function TaxCodeCell({ customer, className }: { customer: Customer; className: string }) {
  if (customer.taxCodeMissing)
    return (
      <Badge
        variant="outline"
        className="text-[0.6875rem]"
        title={SALES_OWNER_LABELS.list.taxCodeMissingHint}
      >
        {SALES_OWNER_LABELS.list.taxCodeMissing}
      </Badge>
    );
  return <span className={className}>{customer.taxCode ?? "—"}</span>;
}
