"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Eye } from "lucide-react";
import { cn } from "cn";

import { ADMIN_ROUTES, ORDER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import { dateCell, moneyCell, statusCell } from "@/components/shared/column-helpers";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import {
  DEFAULT_ORDERS_CONFIG,
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_VISIBLE_COLUMNS,
  mergeOrdersConfig,
  ORDER_COLUMN_SEARCH_LABELS,
  ORDER_SEARCH_FIELDS,
  ORDER_TABLE_COLUMN_LABELS,
  orderStatTiles,
  ORDERS_STORAGE_KEY,
} from "../list-config";
import { useOrders } from "../queries";
import { computeOrderStats, formatMoney, shouldFlagOrderRow } from "../selectors";

import type {
  OrderColumnSearchKey,
  OrdersPageConfig,
  OrderSearchField,
  OrderTableColumnKey,
} from "../list-config";
import type { Order } from "@/lib/mock-data";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

const STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({
  label: STATUS_LABEL_VI[value] ?? value,
  value,
}));

const COLUMN_OPTIONS = DEFAULT_VISIBLE_COLUMNS.map((value) => ({
  label: ORDER_TABLE_COLUMN_LABELS[value],
  value,
}));

const SEARCH_FIELD_VALUES = ORDER_SEARCH_FIELDS.map((field) => field.value);

export function OrderList() {
  // page/setPage không dùng — DataTable tự phân trang client-side nội bộ (A10).
  const { status, setStatus, q, setQ, debouncedQ } = useUrlFilters(ORDER_STATUSES);
  const { config, setConfig, updateConfig } = usePageConfig<OrdersPageConfig>(
    ORDERS_STORAGE_KEY,
    DEFAULT_ORDERS_CONFIG,
    mergeOrdersConfig,
  );
  const router = useRouter();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const ordersQuery = useOrders({ status, q: debouncedQ, size: 200 });
  const items = ordersQuery.data?.items;

  const toggleStatus = (value: (typeof ORDER_STATUSES)[number]) => {
    setStatus(status.includes(value) ? status.filter((s) => s !== value) : [...status, value]);
  };

  const toggleSearchField = (field: OrderSearchField) => {
    updateConfig((current) => ({
      ...current,
      searchFields: current.searchFields.includes(field)
        ? current.searchFields.filter((item) => item !== field)
        : [...current.searchFields, field],
    }));
  };

  const toggleTableColumn = (column: OrderTableColumnKey) => {
    if (column === "actions") return;
    updateConfig((current) => {
      const next = current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column];
      return {
        ...current,
        visibleColumns: next.includes("actions") ? next : [...next, "actions"],
      };
    });
  };

  const updateColumnSearch = (key: OrderColumnSearchKey, value: string) => {
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  };

  const resetFields = () =>
    updateConfig((current) => ({ ...current, searchFields: DEFAULT_SEARCH_FIELDS }));
  const resetColumns = () =>
    updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS }));
  const clearColumnSearch = () => updateConfig((current) => ({ ...current, columnSearch: {} }));
  const resetAll = () => {
    setConfig(DEFAULT_ORDERS_CONFIG);
    setStatus([]);
    setQ("");
  };

  // Search chính + status đã lọc ở server (mock route đọc `q`/`status`); phần dưới
  // chỉ thu hẹp theo "Trường search" và "Search trong cột" — hai pref cục bộ mà
  // URL/server không mang theo.
  const filtered = useMemo(() => {
    let list: Order[] = items ?? [];

    if (debouncedQ.trim() && config.searchFields.length > 0) {
      const needle = normalize(debouncedQ);
      const getters = new Map(ORDER_SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((order) =>
        config.searchFields.some((field) =>
          normalize(getters.get(field)?.(order) ?? "").includes(needle),
        ),
      );
    }

    const orderNumberQuery = normalize(config.columnSearch.orderNumber ?? "");
    if (orderNumberQuery)
      list = list.filter((order) => normalize(order.orderNumber).includes(orderNumberQuery));

    const recipientQuery = normalize(config.columnSearch.recipientName ?? "");
    if (recipientQuery)
      list = list.filter((order) =>
        normalize(`${order.recipientName} ${order.recipientPhone}`).includes(recipientQuery),
      );

    return list;
  }, [items, debouncedQ, config.searchFields, config.columnSearch]);

  const stats = useMemo(() => orderStatTiles(computeOrderStats(filtered)), [filtered]);

  const hasStatusFilter = status.length > 0;
  const hasSearchQuery = Boolean(q.trim());
  const activeColumnSearch = Object.entries(config.columnSearch).filter(([, value]) =>
    value?.trim(),
  );
  const hasFieldConfig =
    config.searchFields.length !== DEFAULT_SEARCH_FIELDS.length ||
    config.searchFields.some((field) => !DEFAULT_SEARCH_FIELDS.includes(field));
  const visibleColumnCount = config.visibleColumns.filter((column) => column !== "actions").length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasSearchQuery ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    config.showStats ||
    hasColumnConfig;

  const columnMap: Record<OrderTableColumnKey, ColumnDef<Order>> = {
    orderNumber: {
      key: "orderNumber",
      header: ORDER_TABLE_COLUMN_LABELS.orderNumber,
      sortable: true,
      compare: (a, b) => a.orderNumber.localeCompare(b.orderNumber),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.orderNumber ?? ""}
          label={ORDER_COLUMN_SEARCH_LABELS.orderNumber}
          placeholder="Lọc mã đơn"
          onChange={(value) => updateColumnSearch("orderNumber", value)}
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    recipientName: {
      key: "recipientName",
      header: ORDER_TABLE_COLUMN_LABELS.recipientName,
      sortable: true,
      compare: (a, b) => a.recipientName.localeCompare(b.recipientName),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.recipientName ?? ""}
          label={ORDER_COLUMN_SEARCH_LABELS.recipientName}
          placeholder="Tên / SĐT"
          onChange={(value) => updateColumnSearch("recipientName", value)}
        />
      ),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-ink-primary text-[0.8125rem]">{row.recipientName}</span>
          <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
            {row.recipientPhone}
          </span>
        </div>
      ),
    },
    placedAt: dateCell<Order>(
      "placedAt",
      ORDER_TABLE_COLUMN_LABELS.placedAt,
      (row) => row.placedAt,
      {
        sortable: true,
        compare: (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime(),
      },
    ),
    grandTotal: moneyCell<Order>(
      "grandTotal",
      ORDER_TABLE_COLUMN_LABELS.grandTotal,
      (row) => row.grandTotal,
      (value) => formatMoney(value),
      { sortable: true, compare: (a, b) => a.grandTotal - b.grandTotal },
    ),
    status: statusCell<Order>(
      "status",
      ORDER_TABLE_COLUMN_LABELS.status,
      (row) => row.status,
      "order",
      { sortable: true, compare: (a, b) => a.status.localeCompare(b.status), withIcon: true },
    ),
    actions: {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          variant="outline"
          size="icon-sm"
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          asChild
        >
          <Link href={ADMIN_ROUTES.orders.detail(row.orderId)} aria-label="Xem chi tiết đơn hàng">
            <Eye className="size-3.5" />
          </Link>
        </Button>
      ),
    },
  };

  const columns = DEFAULT_VISIBLE_COLUMNS.filter((key) => config.visibleColumns.includes(key)).map(
    (key) => columnMap[key],
  );

  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: config.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: hasStatusFilter ? status.map((s) => STATUS_LABEL_VI[s] ?? s).join(", ") : "Tất cả",
      active: hasStatusFilter,
      onClear: () => setStatus([]),
    },
    {
      label: "Search chính",
      value: hasSearchQuery ? `“${q}”` : "Chưa dùng",
      active: hasSearchQuery,
      onClear: () => setQ(""),
    },
    {
      label: "Trường search",
      value:
        config.searchFields
          .map(
            (field) => ORDER_SEARCH_FIELDS.find((option) => option.value === field)?.label ?? field,
          )
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: resetFields,
    },
    {
      label: "Search trong cột",
      value: activeColumnSearch.length
        ? activeColumnSearch
            .map(
              ([key, value]) =>
                `${ORDER_COLUMN_SEARCH_LABELS[key as OrderColumnSearchKey]} “${value}”`,
            )
            .join(", ")
        : "Chưa dùng",
      active: activeColumnSearch.length > 0,
      onClear: clearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: `${visibleColumnCount}/${DEFAULT_VISIBLE_COLUMNS.length - 1}`,
      active: hasColumnConfig,
      onClear: resetColumns,
    },
  ];

  if (ordersQuery.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        subtitle="Theo dõi đơn bán, trạng thái xử lý và các ngoại lệ cần thao tác."
        actions={
          <Button
            type="button"
            variant={config.showStats ? "secondary" : "outline"}
            size="sm"
            onClick={() =>
              updateConfig((current) => ({ ...current, showStats: !current.showStats }))
            }
            className={cn(
              "rounded-[var(--r-sm)]",
              config.showStats &&
                "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
            )}
          >
            <BarChart3 className="size-3.5" />
            {config.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
          </Button>
        }
      />

      <ListStatsPanel
        stats={stats}
        open={config.showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />

      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Tìm đơn theo mã, khách, SĐT..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={status}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => setStatus([])}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={ORDER_SEARCH_FIELDS}
        selectedFields={config.searchFields}
        defaultFields={DEFAULT_SEARCH_FIELDS}
        onToggleField={toggleSearchField}
        onResetFields={resetFields}
        onSelectAllFields={() =>
          updateConfig((current) => ({ ...current, searchFields: SEARCH_FIELD_VALUES }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={COLUMN_OPTIONS}
        selectedColumns={config.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={resetColumns}
        hasColumnConfig={hasColumnConfig}
        selectedCount={selectedKeys.size}
        onBulkDelete={() => {
          toast.info(
            "Xoá đơn hàng",
            `Đã chọn ${selectedKeys.size} đơn hàng. Chức năng này đang ở UI-only.`,
          );
          setSelectedKeys(new Set());
        }}
        onExport={() =>
          toast.success(
            "Xuất file mock",
            `Sẵn sàng xuất ${filtered.length} đơn hàng đang hiển thị.`,
          )
        }
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={!hasAnyConfig}
      />

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.orderId}
        caption={`Hiển thị ${filtered.length} đơn hàng`}
        flagRow={shouldFlagOrderRow}
        onRowClick={(row) => router.push(ADMIN_ROUTES.orders.detail(row.orderId))}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />
    </>
  );
}
