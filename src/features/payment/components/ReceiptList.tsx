"use client";

import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { ReceiptText } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import {
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_ROUTES,
  PAYMENT_STORAGE_KEYS,
  RECEIPT_API_STATUSES,
} from "@/constants/payment";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { useReceipts } from "../queries";
import { usePagedList } from "@/hooks/use-paged-list";

import { RECEIPT_COPY } from "./copy";
import { ReceiptFilters } from "./ReceiptFilters";
import { ReceiptSummaryBar } from "./ReceiptSummaryBar";
import {
  RECEIPT_COLUMN_KEYS,
  RECEIPT_COLUMNS,
  RECEIPT_DEFAULT_COLUMNS,
  RECEIPT_LOCKED_COLUMNS,
  RECEIPT_SORTABLE,
  receiptLinesNamed,
} from "./receipt-columns";

const L = PAYMENT_LABELS.receipts;

function ReceiptListContent() {
  const router = useRouter();
  const canRead = useCan(PAYMENT_RECEIPT_PERMISSIONS.read);
  const paged = usePagedList(PAYMENT_STORAGE_KEYS.receiptsConfig, RECEIPT_SORTABLE);
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(RECEIPT_API_STATUSES));
  // bo-24: ô tìm chính = BE `search` (khách, MST, số hợp đồng, số đơn); mã tham chiếu sao kê là bộ lọc riêng, khớp chính xác
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [reference, setReference] = useQueryState("reference", parseAsString.withDefault(""));
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [receivedFrom, setReceivedFrom] = useQueryState(
    "receivedFrom",
    parseAsString.withDefault(""),
  );
  const [receivedTo, setReceivedTo] = useQueryState("receivedTo", parseAsString.withDefault(""));
  const debouncedReference = useDebouncedValue(reference, 300);
  const debouncedQ = useDebouncedValue(q, 300);
  // BE answers a reversed range with 400 VALIDATION_FAILED: flag it at the field and send nothing (ISO dates sort as text).
  const rangeInverted = !!receivedFrom && !!receivedTo && receivedFrom > receivedTo;
  const filter = {
    status: status ?? undefined,
    reference: debouncedReference.trim() || undefined,
    search: debouncedQ.trim() || undefined,
    customerId: customerId || undefined,
    receivedFrom: receivedFrom || undefined,
    receivedTo: receivedTo || undefined,
  };
  const query = useReceipts(
    { page: paged.apiPage, size: paged.pageSize, sort: paged.apiSort, ...filter },
    { enabled: canRead && !rangeInverted },
  );
  const hasFilters =
    !!status || !!q.trim() || !!reference.trim() || !!customerId || !!receivedFrom || !!receivedTo;
  const named = query.data?.items.find((row) => row.customerId === customerId);
  const columnState = useColumnVisibility(
    PAYMENT_STORAGE_KEYS.receiptsColumns,
    RECEIPT_COLUMN_KEYS,
    { defaults: RECEIPT_DEFAULT_COLUMNS, locked: RECEIPT_LOCKED_COLUMNS },
  );
  // BE trước PR #497 không kèm hợp đồng / đợt trên dòng của danh sách → không có cột "Hợp đồng · Đợt"
  const linesNamed = receiptLinesNamed(query.data?.items);
  const columns = RECEIPT_COLUMNS.filter(
    (column) =>
      columnState.visible.some((key) => key === column.key) &&
      (linesNamed || column.key !== "installments"),
  );
  const clearAll = () => {
    void setStatus(null);
    void setQ("");
    void setReference("");
    void setCustomerId("");
    void setReceivedFrom("");
    void setReceivedTo("");
    paged.clearSort();
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        <ReceiptFilters
          search={q}
          onSearchChange={(value) => {
            void setQ(value);
            paged.resetPage();
          }}
          linesNamed={linesNamed}
          reference={reference}
          onReferenceChange={(value) => {
            void setReference(value);
            paged.resetPage();
          }}
          status={status}
          onStatusChange={(value) => {
            void setStatus(value);
            paged.resetPage();
          }}
          receivedFrom={receivedFrom}
          receivedTo={receivedTo}
          onReceivedFromChange={(value) => {
            void setReceivedFrom(value);
            paged.resetPage();
          }}
          onReceivedToChange={(value) => {
            void setReceivedTo(value);
            paged.resetPage();
          }}
          rangeInverted={rangeInverted}
          customerId={customerId}
          customerName={named?.customerName}
          customerCode={named?.customerCode}
          onClearCustomer={() => void setCustomerId("")}
          onCustomerChange={(value) => {
            void setCustomerId(value);
            paged.resetPage();
          }}
          hasFilters={hasFilters}
          onClear={clearAll}
          columns={columnState}
        />
      )}
      {canRead && <ReceiptSummaryBar filter={filter} disabled={rangeInverted} />}
      {!rangeInverted && (
        <ServerTableBody
          query={query}
          canRead={canRead}
          columns={columns}
          rowKey={(row) => row.receiptId}
          onRowClick={(row) => router.push(PAYMENT_ROUTES.receipts.detail(row.receiptId))}
          noun="phiếu thu"
          errorCopy={RECEIPT_COPY}
          hasFilters={hasFilters}
          onClearFilters={clearAll}
          empty={{
            icon: <ReceiptText className="size-8" />,
            title: L.emptyTitle,
            description: L.emptyDescription,
          }}
          pageSize={paged.pageSize}
          onPageChange={paged.goToPage}
          onPageSizeChange={paged.changePageSize}
          sorting={paged.sorting}
          stickyHeader
        />
      )}
    </div>
  );
}

/**
 * Danh sách phiếu thu (docs 15 §5.3): tìm theo khách / MST / số hợp đồng / số đơn, lọc theo trạng thái, mã tham chiếu sao
 * kê, ngày nhận, khách; tổng + xuất Excel cùng bộ lọc.
 */
export function ReceiptList() {
  return (
    <PermissionBoundary permissions={[PAYMENT_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReceiptListContent />
    </PermissionBoundary>
  );
}
