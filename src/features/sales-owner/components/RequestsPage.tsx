"use client";

import { useState } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { UserRoundSearch } from "lucide-react";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import {
  OWNER_CHANGE_REQUEST_PERMISSIONS,
  OWNER_CHANGE_REQUEST_STATUSES,
  SALES_OWNER_STORAGE_KEYS,
} from "@/constants/sales-owner";

import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useAssignableSales } from "@/lib/references/sales-agents";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { useOwnerChangeRequests } from "../queries";

import { REQUESTS_COPY } from "./copy";
import { ApproveRequestDialog, RejectRequestDialog } from "./RequestDialogs";
import { requestColumns, requestStatusLabel } from "./request-columns";

import type { OwnerChangeRequestStatus } from "@/constants/sales-owner";
import type { OwnerChangeRequest } from "../types";

const NO_SORT = new Set<string>();
const STATUS_OPTIONS = OWNER_CHANGE_REQUEST_STATUSES.map((value) => ({
  value,
  label: requestStatusLabel(value),
}));

function RequestsContent() {
  // Quyết yêu cầu: sales-owner-change-requests:APPROVE (SM, SA) — UI-only, Backend phải re-check
  const canApprove = useCan(OWNER_CHANGE_REQUEST_PERMISSIONS.approve);
  // D42: người phụ trách mới là Sale giao được
  const sales = useAssignableSales(canApprove);
  const paged = usePagedList(SALES_OWNER_STORAGE_KEYS.requestsConfig, NO_SORT);
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(OWNER_CHANGE_REQUEST_STATUSES),
  );
  const query = useOwnerChangeRequests({
    page: paged.apiPage,
    size: paged.pageSize,
    status: status ?? undefined,
  });
  const [open, setOpen] = useState<{
    action: "approve" | "reject";
    request: OwnerChangeRequest;
  } | null>(null);
  const clear = () => {
    void setStatus(null);
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{SALES_OWNER_LABELS.nav.requests}</h1>
      <ListToolbar<OwnerChangeRequestStatus, never, never>
        controlsIn="summary"
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={status ? [status] : []}
        onToggleStatus={(next) => {
          void setStatus(next === status ? null : next);
          paged.resetPage();
        }}
        onClearStatuses={() => void setStatus(null)}
        hasStatusFilter={!!status}
        summaryItems={
          status
            ? [
                {
                  label: "Trạng thái",
                  value: requestStatusLabel(status),
                  active: true,
                  onClear: clear,
                },
              ]
            : []
        }
        onResetAll={clear}
        resetDisabled={!status}
      />
      <ServerTableBody
        query={query}
        canRead
        columns={requestColumns(canApprove, (action, request) => setOpen({ action, request }))}
        rowKey={(r) => r.id}
        noun="yêu cầu"
        errorCopy={REQUESTS_COPY}
        hasFilters={!!status}
        onClearFilters={clear}
        empty={{
          icon: <UserRoundSearch className="size-8" />,
          title: "Chưa có yêu cầu đổi Sale",
          description:
            "Khách gửi yêu cầu từ trang tài khoản; Sale hiện tại không thấy yêu cầu cho tới khi bạn quyết.",
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
        emptyInTable
      />
      {open?.action === "approve" && (
        <ApproveRequestDialog
          request={open.request}
          sales={sales.options ?? []}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.action === "reject" && (
        <RejectRequestDialog request={open.request} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** "Yêu cầu đổi Sale" (`/admin/sales/owner-change-requests`, BR-S15, §10.5) — quản lý. */
export function RequestsPage() {
  return (
    <PermissionBoundary permissions={[OWNER_CHANGE_REQUEST_PERMISSIONS.read]} variant="list">
      <RequestsContent />
    </PermissionBoundary>
  );
}
