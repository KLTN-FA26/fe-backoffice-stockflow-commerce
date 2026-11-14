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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { useReceipts } from "../queries";
import { usePagedList } from "../use-paged-list";

import { RECEIPT_COPY } from "./copy";
import { ReceiptFilters } from "./ReceiptFilters";
import { RECEIPT_COLUMNS, RECEIPT_SORTABLE } from "./receipt-columns";

const L = PAYMENT_LABELS.receipts;

function ReceiptListContent() {
  const router = useRouter();
  const canRead = useCan(PAYMENT_RECEIPT_PERMISSIONS.read);
  const paged = usePagedList(PAYMENT_STORAGE_KEYS.receiptsConfig, RECEIPT_SORTABLE);
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(RECEIPT_API_STATUSES));
  const [reference, setReference] = useQueryState("reference", parseAsString.withDefault(""));
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const debouncedReference = useDebouncedValue(reference, 300);
  const query = useReceipts(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      sort: paged.apiSort,
      status: status ?? undefined,
      reference: debouncedReference.trim() || undefined,
      customerId: customerId || undefined,
    },
    { enabled: canRead },
  );
  const hasFilters = !!status || !!reference.trim() || !!customerId;
  const clearAll = () => {
    void setStatus(null);
    void setReference("");
    void setCustomerId("");
    paged.clearSort();
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        <ReceiptFilters
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
          customerId={customerId}
          onClearCustomer={() => void setCustomerId("")}
          hasFilters={hasFilters}
          onClear={clearAll}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={RECEIPT_COLUMNS}
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
      />
    </div>
  );
}

/** Danh sách phiếu thu (docs 15 §5.3): lọc theo trạng thái, mã tham chiếu sao kê, khách. */
export function ReceiptList() {
  return (
    <PermissionBoundary permissions={[PAYMENT_RECEIPT_PERMISSIONS.viewPage]} variant="list">
      <ReceiptListContent />
    </PermissionBoundary>
  );
}
