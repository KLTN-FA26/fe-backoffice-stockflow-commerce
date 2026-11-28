"use client";

import Link from "next/link";

import { PAYMENT_LABELS, PAYMENT_LIST_LABELS as LL } from "@/constants/labels-payment";
import { CUSTOMER_PERMISSIONS } from "@/constants";
import { PAYMENT_ROUTES, RECEIPT_API_STATUSES } from "@/constants/payment";
import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";
import { useCan } from "@/lib/auth/components/Can";
import { formatDate } from "@/lib/format/date";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FilterSelect } from "@/components/backoffice/FilterSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { ToolbarFilterPopover } from "@/components/shared/ToolbarFilterPopover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receiptStatusLabel } from "../selectors";

import { RECEIPT_COLUMN_LABELS, RECEIPT_COLUMN_KEYS } from "./receipt-columns";

import type { ReceiptApiStatus } from "@/constants/payment";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { ReceiptColumn } from "./receipt-columns";

const L = PAYMENT_LABELS.receipts;
const STATUS_OPTIONS = RECEIPT_API_STATUSES.map((value) => ({
  value,
  label: receiptStatusLabel(value),
}));

function dayLabel(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Toolbar phiếu thu (BE `GET /payment-receipts`, BO-UX-2/7): search chính là BE `search` (bo-24, PR #497: tên / MST
 * khách, số hợp đồng, số đơn); nút Lọc — mã tham chiếu sao kê (khớp chính xác), trạng thái (BE nhận một giá trị) và
 * khách (ô chọn khách, gửi `customerId`; chỉ khi xem được danh bạ khách); hàng facet — khoảng ngày nhận (lỗi khoảng ngược
 * báo tại ô); Ẩn hiện cột; chip Cấu hình cho từng bộ lọc, kể cả khách đến từ link.
 */
export function ReceiptFilters({
  search,
  onSearchChange,
  linesNamed = true,
  reference,
  onReferenceChange,
  status,
  onStatusChange,
  receivedFrom,
  receivedTo,
  onReceivedFromChange,
  onReceivedToChange,
  rangeInverted,
  customerId,
  customerName,
  customerCode,
  onClearCustomer,
  onCustomerChange,
  hasFilters,
  onClear,
  columns,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  /** Trang có cột "Hợp đồng · Đợt" (BE kèm hợp đồng trên dòng); không thì bỏ khỏi popover Ẩn hiện cột. */
  linesNamed?: boolean;
  reference: string;
  onReferenceChange: (value: string) => void;
  status: ReceiptApiStatus | null;
  onStatusChange: (value: ReceiptApiStatus | null) => void;
  /** `YYYY-MM-DD` hoặc "" — ngày nhận tiền (BE `receivedFrom` / `receivedTo`, gồm cả hai đầu). */
  receivedFrom: string;
  receivedTo: string;
  onReceivedFromChange: (value: string) => void;
  onReceivedToChange: (value: string) => void;
  rangeInverted: boolean;
  customerId: string;
  /** Tên + mã khách lấy từ các dòng đang lọc (BE-15). */
  customerName?: string | null;
  customerCode?: string | null;
  onClearCustomer: () => void;
  onCustomerChange: (customerId: string) => void;
  hasFilters: boolean;
  onClear: () => void;
  columns: ColumnVisibility<ReceiptColumn>;
}) {
  // Ô chọn khách tìm trong danh bạ khách (`GET /customers`) — UI-only, BE re-check customer-customers:READ
  const canPickCustomer = useCan(CUSTOMER_PERMISSIONS.read);
  const summary: ListSummaryItem[] = [
    {
      label: LL.searchMain,
      value: search.trim() ? `“${search}”` : LL.notUsed,
      active: search.trim() !== "",
      onClear: () => onSearchChange(""),
    },
    {
      label: L.referenceChip,
      value: reference.trim() ? `“${reference}”` : LL.notUsed,
      active: reference.trim() !== "",
      onClear: () => onReferenceChange(""),
    },
    {
      label: LL.status,
      value: status ? receiptStatusLabel(status) : LL.all,
      active: !!status,
      onClear: () => onStatusChange(null),
    },
  ];
  if (receivedFrom || receivedTo)
    summary.push({
      label: LL.receivedRange,
      value: `${receivedFrom ? dayLabel(receivedFrom) : "…"} – ${receivedTo ? dayLabel(receivedTo) : "…"}`,
      active: true,
      onClear: () => {
        onReceivedFromChange("");
        onReceivedToChange("");
      },
    });
  if (customerId)
    summary.push({
      label: L.customerChip,
      value: <CustomerName id={customerId} name={customerName} code={customerCode} link={false} />,
      active: true,
      onClear: onClearCustomer,
    });
  summary.push(columnSummaryItem(columns));

  return (
    <ListToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={L.searchPlaceholder}
      {...columnToolbarProps(
        columns,
        RECEIPT_COLUMN_LABELS,
        linesNamed
          ? RECEIPT_COLUMN_KEYS
          : RECEIPT_COLUMN_KEYS.filter((column) => column !== "installments"),
      )}
      tools={
        <ToolbarFilterPopover
          label={LL.filters}
          active={!!status || !!customerId || reference.trim() !== ""}
          onClear={() => {
            onReferenceChange("");
            onStatusChange(null);
            onClearCustomer();
          }}
        >
          <div className="flex items-center gap-2">
            <Label htmlFor="receipt-reference" className="text-ink-secondary text-[0.8125rem]">
              {L.referenceLabel}
            </Label>
            <Input
              id="receipt-reference"
              value={reference}
              placeholder={L.referencePlaceholder}
              onChange={(event) => onReferenceChange(event.target.value)}
              className="border-border-default bg-bg-surface h-8 w-[11rem] rounded-[var(--r-sm)] text-[0.8125rem]"
            />
          </div>
          <FilterSelect
            id="receipt-status"
            label={LL.status}
            allLabel={L.statusAll}
            value={status}
            options={STATUS_OPTIONS}
            onChange={onStatusChange}
          />
          {canPickCustomer && (
            <CustomerPicker
              idPrefix="receipt-filter"
              mode="filter"
              value={customerId}
              onChange={onCustomerChange}
            />
          )}
        </ToolbarFilterPopover>
      }
      facets={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="receipt-received-from" className="text-ink-secondary text-[0.8125rem]">
              {L.receivedFrom}
            </Label>
            <DatePicker
              quickKind="past"
              id="receipt-received-from"
              value={receivedFrom}
              onChange={onReceivedFromChange}
              clearable
              aria-invalid={rangeInverted}
              aria-describedby={rangeInverted ? "receipt-range-error" : undefined}
              className="h-8 w-[10.5rem]"
            />
            <Label htmlFor="receipt-received-to" className="text-ink-secondary text-[0.8125rem]">
              {L.receivedTo}
            </Label>
            <DatePicker
              quickKind="past"
              id="receipt-received-to"
              value={receivedTo}
              onChange={onReceivedToChange}
              clearable
              aria-invalid={rangeInverted}
              aria-describedby={rangeInverted ? "receipt-range-error" : undefined}
              className="h-8 w-[10.5rem]"
            />
            {rangeInverted && (
              <p id="receipt-range-error" role="alert" className="text-danger text-xs">
                {L.rangeInverted}
              </p>
            )}
          </div>
          <p className="text-ink-secondary ml-auto text-xs">
            {L.createHint}{" "}
            <Link
              href={PAYMENT_ROUTES.installments.list}
              className="text-accent-text hover:underline"
            >
              {PAYMENT_LABELS.installments.pageTitle}
            </Link>
          </p>
        </>
      }
      summaryItems={summary}
      onResetAll={() => {
        onClear();
        columns.reset();
      }}
      resetDisabled={!hasFilters && !columns.hasColumnConfig}
    />
  );
}
