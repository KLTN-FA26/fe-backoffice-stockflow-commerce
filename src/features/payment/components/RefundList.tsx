"use client";

import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { Undo2 } from "lucide-react";

import { PAYMENT_LABELS, PAYMENT_LIST_LABELS as LL } from "@/constants/labels-payment";
import {
  PAYMENT_REFUND_PERMISSIONS,
  PAYMENT_ROUTES,
  PAYMENT_STORAGE_KEYS,
} from "@/constants/payment";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { ToolbarFilterPopover } from "@/components/shared/ToolbarFilterPopover";

import { useRefunds } from "../queries";
import { usePagedList } from "@/hooks/use-paged-list";

import { REFUND_COPY } from "./copy";
import { REFUND_COLUMNS } from "./refund-columns";

const L = PAYMENT_LABELS.refunds;
const NO_SORT = new Set<string>();

function RefundListContent() {
  const router = useRouter();
  const canRead = useCan(PAYMENT_REFUND_PERMISSIONS.read);
  const paged = usePagedList(PAYMENT_STORAGE_KEYS.refundsConfig, NO_SORT);
  const [outstanding, setOutstanding] = useQueryState("outstanding", parseAsBoolean);
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const query = useRefunds(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      outstanding: outstanding ?? undefined,
      customerId: customerId || undefined,
    },
    { enabled: canRead },
  );
  const hasFilters = outstanding !== null || !!customerId;
  const clearAll = () => {
    void setOutstanding(null);
    void setCustomerId("");
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        // BO-UX-2: toolbar chung. BE `GET /refunds` không có tham số tìm → không có search chính; bảng 5 cột nên không cần
        // Ẩn hiện cột (data-table-mode-a §4.2: > 5 cột). Lọc "còn phải hoàn" trong popover Lọc, có chip.
        <ListToolbar
          tools={
            <ToolbarFilterPopover
              label={LL.filters}
              active={outstanding !== null}
              onClear={() => {
                void setOutstanding(null);
                paged.resetPage();
              }}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id="refund-outstanding"
                  checked={outstanding === true}
                  onCheckedChange={(checked) => {
                    void setOutstanding(checked === true ? true : null);
                    paged.resetPage();
                  }}
                />
                <Label htmlFor="refund-outstanding" className="text-ink-secondary text-[0.8125rem]">
                  {L.outstandingOnly}
                </Label>
              </div>
            </ToolbarFilterPopover>
          }
          summaryItems={[
            {
              label: LL.outstandingOnly,
              value: outstanding ? LL.yes : LL.all,
              active: outstanding !== null,
              onClear: () => {
                void setOutstanding(null);
                paged.resetPage();
              },
            },
            ...(customerId
              ? [
                  {
                    label: PAYMENT_LABELS.receipts.customerChip,
                    value: <CustomerName id={customerId} link={false} />,
                    active: true,
                    onClear: () => {
                      void setCustomerId("");
                      paged.resetPage();
                    },
                  },
                ]
              : []),
          ]}
          onResetAll={clearAll}
          resetDisabled={!hasFilters}
        />
      )}
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={REFUND_COLUMNS}
        rowKey={(row) => row.orderId}
        onRowClick={(row) => router.push(PAYMENT_ROUTES.refunds.ofOrder(row.orderId))}
        noun="đơn cần hoàn tiền"
        errorCopy={REFUND_COPY}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        empty={{
          icon: <Undo2 className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/** Đơn có số tiền phải hoàn do hệ thống tính (docs 15 §4.5): theo dõi chờ hoàn / đã hoàn. */
export function RefundList() {
  return (
    <PermissionBoundary permissions={[PAYMENT_REFUND_PERMISSIONS.viewPage]} variant="list">
      <RefundListContent />
    </PermissionBoundary>
  );
}
