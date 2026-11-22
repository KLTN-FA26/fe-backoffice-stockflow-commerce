"use client";

import Link from "next/link";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES, RECEIPT_API_STATUSES } from "@/constants/payment";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { DatePicker } from "@/components/shared/DatePicker";
import { Label } from "@/components/ui/label";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";

import { receiptStatusLabel } from "../selectors";

import { FilterChip, FilterSelect } from "@/components/backoffice/FilterSelect";

import type { ReceiptApiStatus } from "@/constants/payment";

const L = PAYMENT_LABELS.receipts;
const STATUS_OPTIONS = RECEIPT_API_STATUSES.map((value) => ({
  value,
  label: receiptStatusLabel(value),
}));

/** Lọc phiếu thu (BE `GET /payment-receipts`): mã tham chiếu sao kê (khớp chính xác), trạng thái, ngày nhận, khách. */
export function ReceiptFilters({
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
  hasFilters,
  onClear,
}: {
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
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <SearchBar
        value={reference}
        onChange={onReferenceChange}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchPlaceholder}
        className="max-w-xs"
      />
      <FilterSelect
        id="receipt-status"
        label={PAYMENT_LABELS.columns.status}
        allLabel={L.statusAll}
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatusChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="receipt-received-from" className="text-ink-secondary text-[0.8125rem]">
          {L.receivedFrom}
        </Label>
        <DatePicker
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
      {customerId && (
        <FilterChip label={L.customerChip} onClear={onClearCustomer}>
          <CustomerName id={customerId} name={customerName} code={customerCode} link={false} />
        </FilterChip>
      )}
      {hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={onClear}>
          {PAYMENT_LABELS.installments.clearFilters}
        </Button>
      )}
      <p className="text-ink-tertiary ml-auto text-xs">
        {L.createHint}{" "}
        <Link href={PAYMENT_ROUTES.installments.list} className="text-accent hover:underline">
          {PAYMENT_LABELS.installments.pageTitle}
        </Link>
      </p>
    </div>
  );
}
