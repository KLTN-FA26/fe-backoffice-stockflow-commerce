"use client";

import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { BadgeDollarSign } from "lucide-react";

import {
  CREDIT_REQUEST_API_STATUSES,
  CREDIT_REQUEST_LABELS,
  CREDIT_REQUEST_PERMISSIONS,
  CREDIT_REQUEST_ROUTES,
  CREDIT_REQUEST_STATUS_BY_API,
  CREDIT_REQUEST_STORAGE_KEYS,
} from "@/constants/credit-request";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { statusLabelVi } from "@/lib/status-map";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { useCreditRequests } from "../queries";

import { CREDIT_REQUEST_COPY } from "./copy";
import { CreateCreditRequestDialog } from "./CreateCreditRequestDialog";
import { CREDIT_REQUEST_COLUMNS } from "./list-columns";

import type { CreditRequestApiStatus } from "@/constants/credit-request";

const L = CREDIT_REQUEST_LABELS;
const NO_SORT = new Set<string>();
const statusLabel = (status: CreditRequestApiStatus) =>
  statusLabelVi(CREDIT_REQUEST_STATUS_BY_API[status], "payment") ?? status;
const STATUS_OPTIONS = CREDIT_REQUEST_API_STATUSES.map((value) => ({
  value,
  label: statusLabel(value),
}));

function CreditRequestListContent() {
  const router = useRouter();
  const canRead = useCan(CREDIT_REQUEST_PERMISSIONS.read);
  // UI-only — Backend phải re-check (customer-credit-requests:CREATE)
  const canCreate = useCan(CREDIT_REQUEST_PERMISSIONS.create);
  const paged = usePagedList(CREDIT_REQUEST_STORAGE_KEYS.listConfig, NO_SORT);
  // BE nhận MỘT trạng thái → lọc chọn một
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(CREDIT_REQUEST_API_STATUSES),
  );
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  // Lối từ trang khách (A2): `?create=<customerId>` mở form tạo với khách điền sẵn
  const [createFor, setCreateFor] = useQueryState("create", parseAsString);
  const query = useCreditRequests(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      status: status ?? undefined,
      customerId: customerId || undefined,
    },
    { enabled: canRead },
  );
  const hasFilters = !!status || !!customerId;
  const named = query.data?.items.find((row) => row.customerId === customerId);
  const clearAll = () => {
    void setStatus(null);
    void setCustomerId("");
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canCreate && (
        <HeaderActions>
          <HeaderCreateButton
            tooltip={L.createTooltip}
            aria-label={`Tạo mới ${L.pageTitle.toLowerCase()}`}
            onClick={() => void setCreateFor("")}
          />
        </HeaderActions>
      )}
      {canRead && (
        <ListToolbar<CreditRequestApiStatus, never, never>
          controlsIn="summary"
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={status ? [status] : []}
          onToggleStatus={(next) => {
            void setStatus(next === status ? null : next);
            paged.resetPage();
          }}
          onClearStatuses={() => void setStatus(null)}
          hasStatusFilter={!!status}
          // Chỉ chip của bộ lọc đang bật (bo-28): "Trạng thái: Tất cả" cạnh nút "Lọc trạng thái" là nói một điều hai lần
          summaryItems={[
            ...(status
              ? [
                  {
                    label: "Trạng thái",
                    value: statusLabel(status),
                    active: true,
                    onClear: () => void setStatus(null),
                  },
                ]
              : []),
            ...(customerId
              ? [
                  {
                    label: "Khách hàng",
                    value: named?.customerName ?? named?.customerCode ?? "Đang lọc",
                    active: true,
                    onClear: () => void setCustomerId(""),
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
        columns={CREDIT_REQUEST_COLUMNS}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(CREDIT_REQUEST_ROUTES.detail(row.id))}
        noun="đề nghị"
        errorCopy={CREDIT_REQUEST_COPY}
        hasFilters={hasFilters}
        onClearFilters={clearAll}
        empty={{
          icon: <BadgeDollarSign className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
        emptyInTable
      />
      {canCreate && createFor !== null && (
        <CreateCreditRequestDialog
          customerId={createFor || undefined}
          onClose={() => void setCreateFor(null)}
        />
      )}
    </div>
  );
}

/** Đề nghị cấp hạn mức (15 §4.3 bước 9–11a): danh sách mới nhất trước, lọc trạng thái / khách. */
export function CreditRequestList() {
  return (
    <PermissionBoundary permissions={[CREDIT_REQUEST_PERMISSIONS.viewPage]} variant="list">
      <CreditRequestListContent />
    </PermissionBoundary>
  );
}
