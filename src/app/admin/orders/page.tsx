"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  Eye,
  Package,
  ReceiptText,
  Truck,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { OrderDetailPanel } from "@/components/backoffice/OrderDetailPanel";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { dateCell, moneyCell, statusCell } from "@/components/shared/column-helpers";
import { orders, orderEvents, formatVND, type Order } from "@/lib/mock-data";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import { usePageConfig } from "@/hooks/use-page-config";

type OrderStatusFilter = "all" | Order["status"];
type OrderSearchField = "orderNumber" | "recipientName" | "recipientPhone" | "orderId";
type OrderColumnSearchKey = "orderNumber" | "recipientName";
type OrderTableColumnKey =
  "orderNumber" | "recipientName" | "placedAt" | "grandTotal" | "status" | "actions";

interface OrdersPageConfig {
  showStats: boolean;
  statuses: OrderStatusFilter[];
  globalSearch: {
    query: string;
    fields: OrderSearchField[];
  };
  columnSearch: Partial<Record<OrderColumnSearchKey, string>>;
  visibleColumns: OrderTableColumnKey[];
}

const STORAGE_KEY = "stockflow:admin:orders:config";
const DEFAULT_VISIBLE_COLUMNS: OrderTableColumnKey[] = [
  "orderNumber",
  "recipientName",
  "placedAt",
  "grandTotal",
  "status",
  "actions",
];
const DEFAULT_CONFIG: OrdersPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: { query: "", fields: ["orderNumber", "recipientName"] },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};

function mergeStoredConfig(
  stored: Partial<OrdersPageConfig>,
  fallback: OrdersPageConfig,
): OrdersPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}

const STATUS_OPTIONS = [
  "all",
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Packed",
  "Shipped",
  "In Transit",
  "Delivered",
  "Completed",
  "Cancelled",
  "Returned",
  "Refunded",
  "Partially Refunded",
  "On Hold",
  "Partially Fulfilled",
  "Payment Failed",
  "Delivery Failed",
  "Return Requested",
  "Closed",
].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as OrderStatusFilter,
}));

const SEARCH_FIELDS: {
  label: string;
  value: OrderSearchField;
  getValue: (order: Order) => string;
}[] = [
  { label: "Mã đơn", value: "orderNumber", getValue: (order) => order.orderNumber },
  { label: "Khách", value: "recipientName", getValue: (order) => order.recipientName },
  { label: "SĐT", value: "recipientPhone", getValue: (order) => order.recipientPhone },
  { label: "Order ID", value: "orderId", getValue: (order) => order.orderId },
];

const COLUMN_SEARCH_LABELS: Record<OrderColumnSearchKey, string> = {
  orderNumber: "Mã đơn",
  recipientName: "Khách",
};

const TABLE_COLUMN_LABELS: Record<OrderTableColumnKey, string> = {
  orderNumber: "Mã đơn",
  recipientName: "Khách",
  placedAt: "Ngày đặt",
  grandTotal: "Tổng tiền",
  status: "Trạng thái",
  actions: "Thao tác",
};

function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000)
    return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ ₫`;
  if (amount >= 1_000_000)
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr ₫`;
  return formatVND(amount);
}

function computeStats(list: Order[]) {
  const total = list.length;
  const pending = list.filter((o) => o.status === "Pending Payment").length;
  const processing = list.filter((o) =>
    ["Confirmed", "In Production", "Ready to Fulfill", "Picking", "Packed"].includes(o.status),
  ).length;
  const shipped = list.filter((o) => ["Shipped", "In Transit"].includes(o.status)).length;
  const delivered = list.filter((o) => o.status === "Delivered").length;
  const attention = list.filter((o) =>
    ["Payment Failed", "Delivery Failed", "On Hold", "Partially Fulfilled", "Cancelled"].includes(
      o.status,
    ),
  ).length;
  const revenue = list.reduce((s, o) => s + o.grandTotal, 0);

  return [
    { label: "Tổng đơn", value: total.toString(), icon: ClipboardList },
    { label: "Chờ thanh toán", value: pending.toString(), icon: Clock },
    { label: "Đang xử lý", value: processing.toString(), icon: Package },
    { label: "Đang giao", value: shipped.toString(), icon: Truck },
    { label: "Đã giao", value: delivered.toString(), icon: CheckCircle },
    { label: "Cần chú ý", value: attention.toString(), icon: AlertTriangle },
    { label: "Doanh thu", value: formatCompactVND(revenue), icon: ReceiptText },
  ];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function shouldFlag(row: Order): boolean {
  return ["Payment Failed", "Delivery Failed", "On Hold", "Partially Fulfilled"].includes(
    row.status,
  );
}

export default function OrdersPage() {
  const { config, setConfig, updateConfig } = usePageConfig<OrdersPageConfig>(
    STORAGE_KEY,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const toggleStatus = (status: OrderStatusFilter) => {
    updateConfig((current) => {
      if (status === "all") return { ...current, statuses: ["all"] };
      const withoutAll = current.statuses.filter((item) => item !== "all");
      const next = withoutAll.includes(status)
        ? withoutAll.filter((item) => item !== status)
        : [...withoutAll, status];
      return { ...current, statuses: next.length ? next : ["all"] };
    });
  };

  const toggleSearchField = (field: OrderSearchField) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return { ...current, globalSearch: { ...current.globalSearch, fields } };
    });
  };

  const toggleTableColumn = (column: OrderTableColumnKey) => {
    if (column === "actions") return;
    updateConfig((current) => {
      const visibleColumns = current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column];
      return {
        ...current,
        visibleColumns: visibleColumns.includes("actions")
          ? visibleColumns
          : [...visibleColumns, "actions"],
      };
    });
  };

  const updateColumnSearch = (key: OrderColumnSearchKey, value: string) => {
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  };

  const clearColumnSearch = () => updateConfig((current) => ({ ...current, columnSearch: {} }));
  const resetAll = () => setConfig(DEFAULT_CONFIG);

  const filtered = useMemo(() => {
    let list = orders;
    if (!config.statuses.includes("all"))
      list = list.filter((order) => config.statuses.includes(order.status));

    const q = normalize(config.globalSearch.query);
    if (q && config.globalSearch.fields.length > 0) {
      const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((order) =>
        config.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(order) ?? "").includes(q),
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
  }, [config]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const selectedEvents = useMemo(
    () =>
      selectedOrder ? orderEvents.filter((event) => event.orderId === selectedOrder.orderId) : [],
    [selectedOrder],
  );

  const hasStatusFilter = !config.statuses.includes("all");
  const hasGlobalSearch = Boolean(config.globalSearch.query.trim());
  const activeColumnSearch = Object.entries(config.columnSearch).filter(([, value]) =>
    value?.trim(),
  );
  const defaultSearchFields = DEFAULT_CONFIG.globalSearch.fields;
  const hasFieldConfig =
    config.globalSearch.fields.length !== defaultSearchFields.length ||
    config.globalSearch.fields.some((field) => !defaultSearchFields.includes(field));
  const visibleColumnCount = config.visibleColumns.filter((column) => column !== "actions").length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasGlobalSearch ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    config.showStats ||
    hasColumnConfig;

  const openPanel = (order: Order) => {
    setSelectedOrder(order);
    setPanelOpen(true);
  };

  const columns: (ColumnDef<Order> & { key: OrderTableColumnKey })[] = [
    {
      key: "orderNumber",
      header: "Mã đơn",
      sortable: true,
      compare: (a, b) => a.orderNumber.localeCompare(b.orderNumber),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.orderNumber ?? ""}
          label="Mã đơn"
          placeholder="Lọc mã đơn"
          onChange={(value) => updateColumnSearch("orderNumber", value)}
        />
      ),
      cell: (row) => (
        <Link
          href={`/admin/orders/${row.orderId}`}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => {
            event.preventDefault();
            openPanel(row);
          }}
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "recipientName",
      header: "Khách",
      sortable: true,
      compare: (a, b) => a.recipientName.localeCompare(b.recipientName),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.recipientName ?? ""}
          label="Khách"
          placeholder="Tên / SĐT"
          onChange={(value) => updateColumnSearch("recipientName", value)}
        />
      ),
      cell: (row) => <span className="text-ink-primary text-[0.8125rem]">{row.recipientName}</span>,
    },
    dateCell<Order>("placedAt", "Ngày đặt", (row) => row.placedAt, {
      sortable: true,
      compare: (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime(),
    }) as ColumnDef<Order> & { key: OrderTableColumnKey },
    moneyCell<Order>("grandTotal", "Tổng tiền", (row) => row.grandTotal, formatVND, {
      sortable: true,
      compare: (a, b) => a.grandTotal - b.grandTotal,
    }) as ColumnDef<Order> & { key: OrderTableColumnKey },
    statusCell<Order>("status", "Trạng thái", (row) => row.status, "order", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<Order> & { key: OrderTableColumnKey },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            openPanel(row);
          }}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          aria-label="Xem chi tiết"
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];

  const visibleColumns = columns.filter((column) => config.visibleColumns.includes(column.key));
  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: config.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: config.statuses
        .map((status) => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status)
        .join(", "),
      active: hasStatusFilter,
      onClear: () => updateConfig((current) => ({ ...current, statuses: ["all"] })),
    },
    {
      label: "Search chính",
      value: hasGlobalSearch ? `“${config.globalSearch.query}”` : "Chưa dùng",
      active: hasGlobalSearch,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, query: "" },
        })),
    },
    {
      label: "Trường search",
      value:
        config.globalSearch.fields
          .map((field) => SEARCH_FIELDS.find((option) => option.value === field)?.label ?? field)
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
        })),
    },
    {
      label: "Search trong cột",
      value: activeColumnSearch.length
        ? activeColumnSearch
            .map(
              ([key, value]) => `${COLUMN_SEARCH_LABELS[key as OrderColumnSearchKey]} “${value}”`,
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
      onClear: () =>
        updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
    },
  ];

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
        search={config.globalSearch.query}
        onSearchChange={(value) =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, query: value },
          }))
        }
        searchPlaceholder="Tìm đơn theo mã, khách, SĐT..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={config.statuses}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => updateConfig((current) => ({ ...current, statuses: ["all"] }))}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={SEARCH_FIELDS}
        selectedFields={config.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={toggleSearchField}
        onResetFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
          }))
        }
        onSelectAllFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: SEARCH_FIELDS.map((field) => field.value),
            },
          }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={DEFAULT_VISIBLE_COLUMNS.map((column) => ({
          label: TABLE_COLUMN_LABELS[column],
          value: column,
        }))}
        selectedColumns={config.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS }))
        }
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
        columns={visibleColumns}
        rowKey={(row) => row.orderId}
        caption={`Hiển thị ${filtered.length} đơn hàng`}
        flagRow={shouldFlag}
        onRowClick={openPanel}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />

      <OrderDetailPanel
        order={selectedOrder}
        events={selectedEvents}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />
    </>
  );
}
