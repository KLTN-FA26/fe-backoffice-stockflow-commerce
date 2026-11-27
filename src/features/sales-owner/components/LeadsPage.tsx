"use client";

import { useState } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Inbox } from "lucide-react";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import {
  LEAD_STATUSES,
  SALES_LEAD_PERMISSIONS,
  SALES_OWNER_PERMISSIONS,
  SALES_OWNER_STORAGE_KEYS,
  SALES_WORKLOAD_PERMISSIONS,
} from "@/constants/sales-owner";

import { usePagedList } from "@/hooks/use-paged-list";
import { useAuthStore, useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useAssignableSales } from "@/lib/references/sales-agents";
import { useSalesWorkload } from "@/lib/references/sales-workload";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { useLeads } from "../queries";
import { leadStatusLabel } from "../selectors";

import { LEADS_COPY } from "./copy";
import { leadColumns } from "./lead-columns";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { LeadAssignDialog, LeadContactDialog, LeadDisqualifyDialog } from "./LeadDialogs";

import type { LeadStatus } from "@/constants/sales-owner";
import type { LeadAction } from "../lifecycle";
import type { Lead } from "../types";

const NO_SORT = new Set<string>();
const STATUS_OPTIONS = LEAD_STATUSES.map((value) => ({ value, label: leadStatusLabel(value) }));

function LeadsContent() {
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const canUpdate = useCan(SALES_LEAD_PERMISSIONS.update);
  // Quản lý: hàng chờ, giao, loại; Sale: lead của mình (BE lọc). UI-only — Backend phải re-check
  // (hợp đồng: "Manager" trên FE = người có customer-sales-owners:UPDATE)
  const isManager = useCan(SALES_OWNER_PERMISSIONS.update);
  const canWorkload = useCan(SALES_WORKLOAD_PERMISSIONS.read);
  const canCreateCustomer = useCan(CUSTOMER_PERMISSIONS.create);
  // D42: người nhận lead là Sale giao được; bảng tải chỉ để gợi ý người còn trống nhất
  const sales = useAssignableSales(isManager && canUpdate);
  const workload = useSalesWorkload(isManager && canUpdate && canWorkload);
  const paged = usePagedList(SALES_OWNER_STORAGE_KEYS.leadsConfig, NO_SORT);
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(LEAD_STATUSES));
  const query = useLeads({
    page: paged.apiPage,
    size: paged.pageSize,
    status: status ?? undefined,
  });
  const [open, setOpen] = useState<{ action: LeadAction; lead: Lead } | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const close = () => setOpen(null);
  const clear = () => {
    void setStatus(null);
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{SALES_OWNER_LABELS.nav.leads}</h1>
      <ListToolbar<LeadStatus, never, never>
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
                  value: leadStatusLabel(status),
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
        columns={leadColumns(
          { userId, canUpdate, isManager, canCreateCustomer },
          (action, lead) => setOpen({ action, lead }),
          setDetail,
        )}
        rowKey={(lead) => lead.id}
        onRowClick={setDetail}
        noun="khách tiềm năng"
        errorCopy={LEADS_COPY}
        hasFilters={!!status}
        onClearFilters={clear}
        empty={{
          icon: <Inbox className="size-8" />,
          title: "Chưa có khách tiềm năng",
          description: isManager
            ? "Doanh nghiệp gửi form “Mở tài khoản” trên website sẽ vào đây để giao cho Sale."
            : "Lead được giao cho bạn sẽ hiện ở đây.",
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
        emptyInTable
      />
      {open?.action === "assign" && (
        <LeadAssignDialog
          lead={open.lead}
          sales={sales.options ?? []}
          workload={workload.data ?? []}
          onClose={close}
        />
      )}
      {open?.action === "contact" && <LeadContactDialog lead={open.lead} onClose={close} />}
      {open?.action === "disqualify" && <LeadDisqualifyDialog lead={open.lead} onClose={close} />}
      <LeadDetailPanel lead={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/** "Khách tiềm năng" (`/admin/sales/leads`, §10.3, §10.7) — `sales-leads:READ`. */
export function LeadsPage() {
  return (
    <PermissionBoundary permissions={[SALES_LEAD_PERMISSIONS.read]} variant="list">
      <LeadsContent />
    </PermissionBoundary>
  );
}
