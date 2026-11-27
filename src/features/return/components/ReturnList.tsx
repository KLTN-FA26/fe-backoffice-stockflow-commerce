"use client";

import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Undo2 } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES, RETURN_STORAGE_KEYS, RMA_PERMISSIONS } from "@/constants/returns";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedList } from "@/hooks/use-paged-list";
import { useCan } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { Notice } from "@/components/shared/Notice";
import { PageTabs } from "@/components/shared/PageTabs";

import { matchesReturnRow } from "../list-filters";
import { useReturns } from "../queries";

import { RETURN_COPY } from "./primitives";
import { ReturnListToolbar } from "./ReturnListToolbar";
import { useReturnTableConfig } from "./return-table-config";
import { useReturnStatusFilter } from "./useReturnStatusFilter";

const L = RETURN_LABELS;
const NO_SORT = new Set<string>();
const TABS = ["open", "all"] as const;
type Tab = (typeof TABS)[number] | "vat";
const ROUTE_SEGMENT = RETURN_ROUTES.list.split("/").at(-1);

function ReturnListContent() {
  const router = useRouter();
  const canRead = useCan(RMA_PERMISSIONS.read);
  const paged = usePagedList(RETURN_STORAGE_KEYS.listConfig, NO_SORT);
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("open"));
  // `?vatAdjustment=true` là link của menu Kế toán / thông báo EINVOICE_RETURN_UNADJUSTED — tab riêng
  const [vat, setVat] = useQueryState("vatAdjustment", parseAsBoolean);
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const search = useDebouncedValue(q, 300);
  const active: Tab = vat ? "vat" : tab;
  const status = useReturnStatusFilter(active === "open");
  const query = useReturns(
    {
      page: paged.apiPage,
      size: paged.pageSize,
      statuses: status.statuses,
      vatAdjustment: active === "vat" ? true : undefined,
      search: search || undefined,
    },
    { enabled: canRead },
  );
  const { headerFilters, columnState, columns } = useReturnTableConfig(active === "vat");
  const changeTab = (next: Tab) => {
    void setVat(next === "vat" ? true : null);
    if (next !== "vat") void setTab(next);
    // Lựa chọn trạng thái theo phạm vi tab — đổi tab thì bỏ
    status.clear();
    paged.resetPage();
  };
  const clearAll = () => {
    void setQ("");
    status.clear();
    headerFilters.clear();
    paged.resetPage();
  };

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      <PageTabs<Tab>
        idPrefix="returns"
        ariaLabel={L.pageTitle}
        value={active}
        onChange={changeTab}
        tabs={[
          { value: "open", label: L.tabs.open },
          { value: "all", label: L.tabs.all },
          { value: "vat", label: L.tabs.vatAdjustment },
        ]}
      />
      {active === "vat" && (
        <Notice tone="info" className="mb-3">
          {L.vatAdjustmentHint}
        </Notice>
      )}
      <ReturnListToolbar
        search={q}
        onSearchChange={(value) => {
          void setQ(value || null);
          paged.resetPage();
        }}
        filters={headerFilters}
        status={status}
        onStatusChange={paged.resetPage}
        columns={columnState}
        onResetAll={() => {
          clearAll();
          columnState.reset();
        }}
      />
      <ServerTableBody
        query={query}
        canRead={canRead}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(RETURN_ROUTES.detail(row.id))}
        noun="yêu cầu trả hàng"
        errorCopy={RETURN_COPY}
        hasFilters={!!search || status.active || headerFilters.active}
        onClearFilters={clearAll}
        rowFilter={{
          active: headerFilters.active,
          match: (row) => matchesReturnRow(row, headerFilters.values),
        }}
        empty={{
          icon: <Undo2 className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={paged.pageSize}
        onPageChange={paged.goToPage}
        onPageSizeChange={paged.changePageSize}
        stickyHeader
        emptyInTable
      />
    </div>
  );
}

/**
 * Hàng đợi yêu cầu trả hàng (docs 17 §4.10): Sale duyệt / từ chối, kho xem yêu cầu chờ hàng về, Kế toán xem tab
 * "Cần hoá đơn điều chỉnh" (BE `GET /returns?vatAdjustment=true`, docs 21 §4.4). Mở trang cần `sales-rmas:VIEW_PAGE`.
 */
export function ReturnList() {
  useBreadcrumbLabel(ROUTE_SEGMENT, L.pageTitle);
  return (
    <PermissionBoundary permissions={[RMA_PERMISSIONS.viewPage]} variant="list">
      <ReturnListContent />
    </PermissionBoundary>
  );
}
