"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Plus, Star, Truck, Users } from "lucide-react";
import { cn } from "cn";

import { ADMIN_ROUTES } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel, type ListStatItem } from "@/components/shared/ListStatsPanel";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { computeSupplierStats } from "@/features/supplier";
import { buildSupplierColumns } from "./supplier-list/columns";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  SEARCH_FIELDS,
  STATUS_OPTIONS,
} from "./supplier-list/constants";
import { buildSummaryItems } from "./supplier-list/summary";
import { useSupplierListState } from "./supplier-list/useSupplierListState";

export function SupplierList() {
  const router = useRouter();
  const {
    suppliersQuery,
    pageConfig,
    filtered,
    flags,
    filters,
    updateConfig,
    navigateToDetail,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    clearColumnSearch,
  } = useSupplierListState();
  const stats = useMemo(() => {
    const s = computeSupplierStats(filtered);
    return [
      { label: "Tổng NCC", value: String(s.total), icon: Users },
      { label: "Đang hoạt động", value: String(s.active), icon: Truck },
      { label: "Ngừng hoạt động", value: String(s.inactive), icon: BarChart3 },
      { label: "Tỷ lệ hoạt động", value: `${s.activeRate}%`, icon: Star },
    ] as ListStatItem[];
  }, [filtered]);
  const columns = useMemo(
    () =>
      buildSupplierColumns({
        columnSearch: pageConfig.columnSearch,
        updateColumnSearch,
        navigateToDetail,
      }),
    [pageConfig.columnSearch, updateColumnSearch, navigateToDetail],
  );
  const visibleColumns = columns.filter((c) => pageConfig.visibleColumns.includes(c.key));
  const columnOptions = DEFAULT_COLUMNS.filter((c) => c !== "actions").map((c) => ({
    label: COLUMN_LABELS[c],
    value: c,
  }));
  const summaryItems = useMemo(
    () => buildSummaryItems({ pageConfig, flags, filters, updateConfig, clearColumnSearch }),
    [pageConfig, flags, filters, updateConfig, clearColumnSearch],
  );
  if (suppliersQuery.isLoading) return <PageSkeleton variant="list" />;
  return (
    <>
      <PageHeader
        title="Quản lý nhà cung cấp"
        subtitle="Hồ sơ nhà cung cấp, mã thuế, điều khoản và trạng thái hoạt động."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={pageConfig.showStats ? "secondary" : "outline"}
              size="sm"
              onClick={() => updateConfig((c) => ({ ...c, showStats: !c.showStats }))}
              className={cn(
                "rounded-[var(--r-sm)]",
                pageConfig.showStats &&
                  "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
              )}
            >
              <BarChart3 className="size-3.5" />
              {pageConfig.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`${ADMIN_ROUTES.suppliers}/create`)}
              className="rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" /> Thêm nhà cung cấp
            </Button>
          </div>
        }
      />
      <ListStatsPanel open={pageConfig.showStats} stats={stats} />
      <ListToolbar
        search={filters.q}
        onSearchChange={(v) => filters.setQ(v)}
        searchPlaceholder="Tìm NCC theo mã, tên, mã thuế..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={filters.status}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => filters.setStatus([])}
        hasStatusFilter={flags.hasStatusFilter}
        fieldOptions={SEARCH_FIELDS.map(({ label, value }) => ({ label, value }))}
        selectedFields={pageConfig.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={toggleSearchField}
        hasFieldConfig={flags.hasFieldConfig}
        columnOptions={columnOptions}
        selectedColumns={pageConfig.visibleColumns}
        defaultColumns={DEFAULT_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={flags.visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={() => updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS }))}
        hasColumnConfig={flags.hasColumnConfig}
        onExport={() => {}}
        summaryItems={summaryItems}
        onResetAll={() => {
          updateConfig(() => DEFAULT_CONFIG);
          filters.reset();
        }}
        resetDisabled={!flags.hasAny}
      />
      <DataTable
        columns={visibleColumns}
        data={filtered}
        rowKey={(s) => s.supplierId}
        caption={`Hiển thị ${filtered.length} nhà cung cấp`}
        flagRow={(s) => s.status === "Inactive"}
        onRowClick={navigateToDetail}
        pageSize={15}
        pageSizeOptions={[10, 15, 20, 50]}
      />
    </>
  );
}
