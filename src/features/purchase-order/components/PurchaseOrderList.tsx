"use client";

import { BarChart3, FileText, Plus, Wallet } from "lucide-react";
import { cn } from "cn";

import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { useUrlTab } from "@/hooks/use-url-filters";

import type { PurchaseOrder } from "@/features/purchase-order";
import {
  DEFAULT_CONFIG,
  DEFAULT_VISIBLE_COLUMNS,
  STATUS_OPTIONS,
  TABLE_COLUMN_LABELS,
} from "./list/config";
import { PoListTable } from "./list/PoListTable";
import { SupplierSpendSection } from "./list/SupplierSpendSection";
import { usePoListColumns } from "./list/usePoListColumns";
import { usePoListController } from "./list/usePoListController";
import { buildPoSummaryItems, poListFlags } from "./list/poSummary";

type PoTabKey = "orders" | "spend";
const TABS: { key: PoTabKey; label: string; icon: typeof FileText }[] = [
  { key: "orders", label: "Đơn đặt hàng", icon: FileText },
  { key: "spend", label: "Chi tiêu NCC", icon: Wallet },
];

export function PurchaseOrderList() {
  const c = usePoListController();
  const [activeTab, setActiveTab] = useUrlTab("tab", ["orders", "spend"] as const, "orders");
  const flags = poListFlags(c.config);
  const columns = usePoListColumns({
    suppliers: c.suppliers,
    warehouses: c.warehouses,
    columnSearch: c.config.columnSearch,
    onColumnSearch: c.updateColumnSearch,
    onNavigate: (po) => c.router.push(`/admin/purchase-orders/${po.poId}`),
  });
  const visibleColumns = columns.filter((col) => c.config.visibleColumns.includes(col.key));
  const summaryItems = buildPoSummaryItems(
    c.config,
    c.searchFields,
    flags.hasStatusFilter,
    flags.hasGlobalSearch,
    flags.hasFieldConfig,
    flags.activeColumnSearch,
    flags.visibleColumnCount,
    flags.hasColumnConfig,
    () => c.filters.setStatus([]),
    () => c.filters.setQ(""),
    () =>
      c.updateConfig((x) => ({
        ...x,
        globalSearch: { ...x.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
      })),
    () => c.updateConfig((x) => ({ ...x, columnSearch: {} })),
    () => c.updateConfig((x) => ({ ...x, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
  );

  if (c.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PageHeader
        title="Đơn đặt NCC"
        subtitle="Theo dõi vòng đời PO, nhà cung cấp, giá trị và tiến độ nhận hàng."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "orders" && (
              <Button
                type="button"
                variant={c.config.showStats ? "secondary" : "outline"}
                size="sm"
                onClick={() => c.updateConfig((x) => ({ ...x, showStats: !x.showStats }))}
                className={cn(
                  "rounded-[var(--r-sm)]",
                  c.config.showStats &&
                    "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
                )}
              >
                <BarChart3 className="size-3.5" />
                {c.config.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
              </Button>
            )}
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={() => c.router.push("/admin/purchase-orders/create")}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Tạo đơn đặt hàng
            </Button>
          </div>
        }
      />

      <div className="border-border-default mb-4 flex gap-0 border-b">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              type="button"
              variant="ghost"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "hover:bg-bg-muted/60 h-auto rounded-none border-b-2 bg-transparent px-4 py-2 text-[0.8125rem] font-medium transition-colors",
                isActive
                  ? "border-brand text-brand hover:text-brand"
                  : "text-ink-tertiary hover:text-ink-primary border-transparent",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              {tab.key === "orders" && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                    isActive ? "bg-brand text-ink-inverse" : "bg-bg-muted text-ink-tertiary",
                  )}
                >
                  {c.total}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {activeTab === "orders" ? (
        <>
          <ListStatsPanel
            stats={c.stats as never}
            open={c.config.showStats}
            gridClassName="lg:grid-cols-4 xl:grid-cols-7"
          />
          <PoListTable
            search={c.config.globalSearch.query}
            onSearchChange={c.filters.setQ}
            statusProps={{
              options: STATUS_OPTIONS,
              selected: c.config.statuses,
              onToggle: c.toggleStatus,
              onClear: () => c.filters.setStatus([]),
              hasFilter: flags.hasStatusFilter,
            }}
            fieldProps={{
              options: c.searchFields as never,
              selected: c.config.globalSearch.fields as never,
              defaults: DEFAULT_CONFIG.globalSearch.fields as never,
              onToggle: c.toggleSearchField as never,
              onReset: () =>
                c.updateConfig((x) => ({
                  ...x,
                  globalSearch: { ...x.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
                })),
              onSelectAll: () =>
                c.updateConfig((x) => ({
                  ...x,
                  globalSearch: {
                    ...x.globalSearch,
                    fields: c.searchFields.map((f) => f.value) as never,
                  },
                })),
              hasConfig: flags.hasFieldConfig,
            }}
            columnProps={{
              options: DEFAULT_VISIBLE_COLUMNS.map((col) => ({
                label: TABLE_COLUMN_LABELS[col],
                value: col,
              })),
              selected: c.config.visibleColumns,
              defaults: DEFAULT_VISIBLE_COLUMNS,
              locked: ["actions"],
              count: flags.visibleColumnCount,
              onToggle: c.toggleTableColumn as never,
              onReset: () =>
                c.updateConfig((x) => ({ ...x, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
              hasConfig: flags.hasColumnConfig,
            }}
            selectedCount={c.selectedKeys.size}
            onBulkDelete={() => {
              toast.info("Xoá PO", `Đã chọn ${c.selectedKeys.size} đơn. Chức năng UI-only.`);
              c.setSelectedKeys(new Set());
            }}
            onExport={() =>
              toast.success(
                "Xuất file mock",
                `Sẵn sàng xuất ${c.filtered.length} đơn đang hiển thị.`,
              )
            }
            summaryItems={summaryItems}
            onResetAll={() => {
              c.updateConfig(() => DEFAULT_CONFIG);
              c.filters.reset();
            }}
            resetDisabled={!flags.hasAnyConfig}
            filtered={c.filtered}
            visibleColumns={visibleColumns as never}
            onRowClick={(r: PurchaseOrder) => c.router.push(`/admin/purchase-orders/${r.poId}`)}
            selectedKeys={c.selectedKeys}
            onSelectionChange={c.setSelectedKeys}
            total={c.total}
            page={c.page}
            pageSize={c.pageSize}
            onPageChange={(p) => c.filters.setPage(p)}
            onPageSizeChange={(s) => c.setPageSize(s)}
          />
        </>
      ) : (
        <SupplierSpendSection />
      )}
    </>
  );
}
