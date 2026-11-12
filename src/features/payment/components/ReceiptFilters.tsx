"use client";

import Link from "next/link";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES, RECEIPT_API_STATUSES } from "@/constants/payment";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";

import { receiptStatusLabel } from "../selectors";

import { FilterChip, FilterSelect } from "./FilterSelect";

import type { ReceiptApiStatus } from "@/constants/payment";

const L = PAYMENT_LABELS.receipts;
const STATUS_OPTIONS = RECEIPT_API_STATUSES.map((value) => ({
  value,
  label: receiptStatusLabel(value),
}));

/** Lọc phiếu thu (BE `GET /payment-receipts`): mã tham chiếu sao kê (khớp chính xác), trạng thái, khách. */
export function ReceiptFilters({
  reference,
  onReferenceChange,
  status,
  onStatusChange,
  customerId,
  onClearCustomer,
  hasFilters,
  onClear,
}: {
  reference: string;
  onReferenceChange: (value: string) => void;
  status: ReceiptApiStatus | null;
  onStatusChange: (value: ReceiptApiStatus | null) => void;
  customerId: string;
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
      {customerId && (
        <FilterChip label={L.customerChip} onClear={onClearCustomer}>
          <CustomerName id={customerId} link={false} />
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
