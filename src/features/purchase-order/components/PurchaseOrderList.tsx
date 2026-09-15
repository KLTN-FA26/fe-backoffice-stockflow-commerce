"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Eye,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { cn } from "cn";
import { ADMIN_ROUTES, PAGE_SIZE, PO_COLUMNS, PO_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { dateCell, statusCell, textCell } from "@/components/shared/column-helpers";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import {
  computePoStats,
  formatCompactVND,
  formatMoney,
  shouldFlagPoRow,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrders,
} from "@/features/purchase-order";

import type { PurchaseOrder, Supplier, Warehouse } from "@/features/purchase-order";

type PoStatusFilter = "all" | PurchaseOrder["status"];
type PoSearchField =
  typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER | typeof PO_COLUMNS.WAREHOUSE | "poId";
type PoColumnSearchKey =
  typeof PO_COLUMNS.PO_NUMBER | typeof PO_COLUMNS.SUPPLIER | typeof PO_COLUMNS.WAREHOUSE;
type PoTableColumnKey = (typeof PO_COLUMNS)[keyof typeof PO_COLUMNS];

interface PurchaseOrdersPageConfig {
  showStats: boolean;
  statuses: PoStatusFilter[];
  globalSearch: { query: string; fields: PoSearchField[] };
  columnSearch: Partial<Record<PoColumnSearchKey, string>>;
  visibleColumns: PoTableColumnKey[];
}

const DEFAULT_VISIBLE_COLUMNS: PoTableColumnKey[] = [
  PO_COLUMNS.PO_NUMBER,
  PO_COLUMNS.SUPPLIER,
  PO_COLUMNS.WAREHOUSE,
  PO_COLUMNS.EXPECTED_DATE,
  PO_COLUMNS.GRAND_TOTAL,
  PO_COLUMNS.STATUS,
  PO_COLUMNS.ACTIONS,
];
const DEFAULT_CONFIG: PurchaseOrdersPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: { query: "", fields: [PO_COLUMNS.PO_NUMBER, PO_COLUMNS.SUPPLIER] },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};
const STATUS_OPTIONS = ["all", ...PO_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as PoStatusFilter,
}));

const TABLE_COLUMN_LABELS: Record<PoTableColumnKey, string> = {
  [PO_COLUMNS.ACTIONS]: "Thao tác",
  [PO_COLUMNS.EXPECTED_DATE]: "Ngày giao DK",
  [PO_COLUMNS.GRAND_TOTAL]: "Tổng tiền",
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.STATUS]: "Trạng thái",
  [PO_COLUMNS.SUPPLIER]: "Nhà cung cấp",
  [PO_COLUMNS.WAREHOUSE]: "Kho nhận",
};

const COLUMN_SEARCH_LABELS: Record<PoColumnSearchKey, string> = {
  [PO_COLUMNS.PO_NUMBER]: "Mã PO",
  [PO_COLUMNS.SUPPLIER]: "Nhà cung cấp",
  [PO_COLUMNS.WAREHOUSE]: "Kho nhận",
};

function supplierName(po: PurchaseOrder, suppliers: readonly Supplier[]) {
  return suppliers.find((supplier) => supplier.supplierId === po.supplierId)?.name ?? "";
}

function warehouseName(po: PurchaseOrder, warehouses: readonly Warehouse[]) {
  return warehouses.find((warehouse) => warehouse.warehouseId === po.warehouseId)?.name ?? "";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function mergeStoredConfig(
  stored: Partial<PurchaseOrdersPageConfig>,
  fallback: PurchaseOrdersPageConfig,
): PurchaseOrdersPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}

export function PurchaseOrderList() {
  const router = useRouter();
  const filters = useUrlFilters(PO_STATUSES);
  const { config, updateConfig } = usePageConfig<PurchaseOrdersPageConfig>(
    STORAGE_KEYS.adminPurchaseOrdersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const purchaseOrdersQuery = usePurchaseOrders({ page: 1, pageSize: PAGE_SIZE.masterData });
  const suppliersQuery = usePoSuppliers({});
  const warehousesQuery = usePoWarehouses({});

  const purchaseOrders = useMemo(
    () => purchaseOrdersQuery.data?.items ?? [],
    [purchaseOrdersQuery.data],
  );
  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);

  const searchFields = useMemo(
    () => [
      { label: "Mã PO", value: PO_COLUMNS.PO_NUMBER, getValue: (po: PurchaseOrder) => po.poNumber },
      {
        label: "Nhà cung cấp",
        value: PO_COLUMNS.SUPPLIER,
        getValue: (po: PurchaseOrder) => supplierName(po, suppliers),
      },
      {
        label: "Kho nhận",
        value: PO_COLUMNS.WAREHOUSE,
        getValue: (po: PurchaseOrder) => warehouseName(po, warehouses),
      },
      { label: "PO ID", value: "poId" as const, getValue: (po: PurchaseOrder) => po.poId },
    ],
    [suppliers, warehouses],
  );

  const isLoading =
    purchaseOrdersQuery.isLoading || suppliersQuery.isLoading || warehousesQuery.isLoading;

  const pageConfig = useMemo<PurchaseOrdersPageConfig>(
    () => ({
      ...config,
      statuses: filters.status.length > 0 ? filters.status : ["all"],
      globalSearch: { ...config.globalSearch, query: filters.q },
    }),
    [config, filters.q, filters.status],
  );

  const navigateToDetail = (po: PurchaseOrder) =>
    router.push(ADMIN_ROUTES.purchaseOrders.detail(po.poId));

  const toggleStatus = (status: PoStatusFilter) => {
    if (status === "all") {
      filters.setStatus([]);
      return;
    }
    const next = filters.status.includes(status)
      ? filters.status.filter((item) => item !== status)
      : [...filters.status, status];
    filters.setStatus(next);
  };

  const toggleSearchField = (field: PoSearchField) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return { ...current, globalSearch: { ...current.globalSearch, fields } };
    });
  };

  const toggleTableColumn = (column: PoTableColumnKey) => {
    if (column === PO_COLUMNS.ACTIONS) return;
    updateConfig((current) => {
      const visibleColumns = current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column];
      return {
        ...current,
        visibleColumns: visibleColumns.includes(PO_COLUMNS.ACTIONS)
          ? visibleColumns
          : [...visibleColumns, PO_COLUMNS.ACTIONS],
      };
    });
  };

  const updateColumnSearch = (key: PoColumnSearchKey, value: string) =>
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  const clearColumnSearch = () => updateConfig((current) => ({ ...current, columnSearch: {} }));
  const resetAll = () => {
    updateConfig(() => DEFAULT_CONFIG);
    filters.reset();
  };

  const filtered = useMemo(() => {
    let list = purchaseOrders;
    if (!pageConfig.statuses.includes("all"))
      list = list.filter((po) => pageConfig.statuses.includes(po.status));

    const q = normalize(pageConfig.globalSearch.query);
    if (q && pageConfig.globalSearch.fields.length > 0) {
      const fieldMap = new Map(searchFields.map((field) => [field.value, field.getValue]));
      list = list.filter((po) =>
        pageConfig.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(po) ?? "").includes(q),
        ),
      );
    }

    const poQuery = normalize(pageConfig.columnSearch.poNumber ?? "");
    if (poQuery) list = list.filter((po) => normalize(po.poNumber).includes(poQuery));
    const supplierQuery = normalize(pageConfig.columnSearch.supplier ?? "");
    if (supplierQuery)
      list = list.filter((po) => normalize(supplierName(po, suppliers)).includes(supplierQuery));
    const warehouseQuery = normalize(pageConfig.columnSearch.warehouse ?? "");
    if (warehouseQuery)
      list = list.filter((po) => normalize(warehouseName(po, warehouses)).includes(warehouseQuery));

    return list;
  }, [pageConfig, purchaseOrders, searchFields, suppliers, warehouses]);

  const stats = useMemo(() => {
    const poStats = computePoStats(filtered);
    return [
      { label: "Tổng PO", value: poStats.total.toString(), icon: ShoppingCart },
      { label: "Nháp", value: poStats.draft.toString(), icon: Clock },
      { label: "Chờ duyệt", value: poStats.pendingApproval.toString(), icon: ClipboardCheck },
      { label: "Đã xác nhận", value: poStats.confirmed.toString(), icon: CheckCircle },
      { label: "Đang nhận", value: poStats.partiallyReceived.toString(), icon: Truck },
      { label: "Đã nhận", value: poStats.received.toString(), icon: PackageCheck },
      { label: "Tổng giá trị", value: formatCompactVND(poStats.totalValueVND), icon: ReceiptText },
    ];
  }, [filtered]);
  const hasStatusFilter = !pageConfig.statuses.includes("all");
  const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
  const activeColumnSearch = Object.entries(pageConfig.columnSearch).filter(([, value]) =>
    value?.trim(),
  );
  const defaultSearchFields = DEFAULT_CONFIG.globalSearch.fields;
  const hasFieldConfig =
    pageConfig.globalSearch.fields.length !== defaultSearchFields.length ||
    pageConfig.globalSearch.fields.some((field) => !defaultSearchFields.includes(field));
  const visibleColumnCount = pageConfig.visibleColumns.filter(
    (column) => column !== PO_COLUMNS.ACTIONS,
  ).length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasGlobalSearch ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    pageConfig.showStats ||
    hasColumnConfig;

  const columns: (ColumnDef<PurchaseOrder> & { key: PoTableColumnKey })[] = [
    {
      key: PO_COLUMNS.PO_NUMBER,
      header: "Mã PO",
      sortable: true,
      compare: (a, b) => a.poNumber.localeCompare(b.poNumber),
      headerFilter: (
        <ColumnFilterButton
          value={pageConfig.columnSearch.poNumber ?? ""}
          label="Mã PO"
          placeholder="Lọc mã PO"
          onChange={(value) => updateColumnSearch(PO_COLUMNS.PO_NUMBER, value)}
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.purchaseOrders.detail(row.poId)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => {
            event.preventDefault();
            navigateToDetail(row);
          }}
        >
          {row.poNumber}
        </Link>
      ),
    },
    {
      ...textCell<PurchaseOrder>(
        PO_COLUMNS.SUPPLIER,
        "Nhà cung cấp",
        (row) => supplierName(row, suppliers) || "—",
        {
          sortable: true,
          compare: (a, b) => supplierName(a, suppliers).localeCompare(supplierName(b, suppliers)),
          color: "primary",
        },
      ),
      key: PO_COLUMNS.SUPPLIER,
      headerFilter: (
        <ColumnFilterButton
          value={pageConfig.columnSearch.supplier ?? ""}
          label="Nhà cung cấp"
          placeholder="Lọc NCC"
          onChange={(value) => updateColumnSearch(PO_COLUMNS.SUPPLIER, value)}
        />
      ),
    },
    {
      ...textCell<PurchaseOrder>(
        PO_COLUMNS.WAREHOUSE,
        "Kho nhận",
        (row) => warehouseName(row, warehouses) || "—",
        {
          sortable: true,
          compare: (a, b) =>
            warehouseName(a, warehouses).localeCompare(warehouseName(b, warehouses)),
          color: "secondary",
        },
      ),
      key: PO_COLUMNS.WAREHOUSE,
      headerFilter: (
        <ColumnFilterButton
          value={pageConfig.columnSearch.warehouse ?? ""}
          label="Kho nhận"
          placeholder="Lọc kho"
          onChange={(value) => updateColumnSearch(PO_COLUMNS.WAREHOUSE, value)}
        />
      ),
    },
    dateCell<PurchaseOrder>("expectedDate", "Ngày giao DK", (row) => row.expectedDate, {
      sortable: true,
      compare: (a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime(),
    }) as ColumnDef<PurchaseOrder> & { key: PoTableColumnKey },
    {
      key: "grandTotal",
      header: "Tổng tiền",
      align: "right",
      sortable: true,
      compare: (a, b) => a.grandTotal - b.grandTotal,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
          {formatMoney(row.grandTotal, row.currency)}
        </span>
      ),
    },
    statusCell<PurchaseOrder>("status", "Trạng thái", (row) => row.status, "po", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<PurchaseOrder> & { key: PoTableColumnKey },
    {
      key: PO_COLUMNS.ACTIONS,
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            navigateToDetail(row);
          }}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          aria-label="Xem chi tiết"
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];

  const visibleColumns = columns.filter((column) => pageConfig.visibleColumns.includes(column.key));
  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: pageConfig.statuses
        .map((status) => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status)
        .join(", "),
      active: hasStatusFilter,
      onClear: () => filters.setStatus([]),
    },
    {
      label: "Search chính",
      value: hasGlobalSearch ? `“${pageConfig.globalSearch.query}”` : "Chưa dùng",
      active: hasGlobalSearch,
      onClear: () => filters.setQ(""),
    },
    {
      label: "Trường search",
      value:
        pageConfig.globalSearch.fields
          .map((field) => searchFields.find((option) => option.value === field)?.label ?? field)
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
            .map(([key, value]) => `${COLUMN_SEARCH_LABELS[key as PoColumnSearchKey]} “${value}”`)
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

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <>
      <PageHeader
        title="Đơn đặt NCC"
        subtitle="Theo dõi vòng đời PO, nhà cung cấp, giá trị và tiến độ nhận hàng."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={pageConfig.showStats ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                updateConfig((current) => ({ ...current, showStats: !current.showStats }))
              }
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
              type="button"
              size="sm"
              onClick={() => router.push(ADMIN_ROUTES.purchaseOrders.create)}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Tạo đơn đặt hàng
            </Button>
          </div>
        }
      />

      <ListStatsPanel
        stats={stats}
        open={pageConfig.showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />

      <ListToolbar
        search={pageConfig.globalSearch.query}
        onSearchChange={filters.setQ}
        searchPlaceholder="Tìm PO theo mã, NCC, kho..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={pageConfig.statuses}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => filters.setStatus([])}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={searchFields}
        selectedFields={pageConfig.globalSearch.fields}
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
              fields: searchFields.map((field) => field.value),
            },
          }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={DEFAULT_VISIBLE_COLUMNS.map((column) => ({
          label: TABLE_COLUMN_LABELS[column],
          value: column,
        }))}
        selectedColumns={pageConfig.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={[PO_COLUMNS.ACTIONS]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS }))
        }
        hasColumnConfig={hasColumnConfig}
        selectedCount={selectedKeys.size}
        onBulkDelete={() => {
          toast.info(
            "Xoá PO",
            `Đã chọn ${selectedKeys.size} đơn đặt hàng. Chức năng này đang ở UI-only.`,
          );
          setSelectedKeys(new Set());
        }}
        onExport={() =>
          toast.success(
            "Xuất file mock",
            `Sẵn sàng xuất ${filtered.length} đơn đặt hàng đang hiển thị.`,
          )
        }
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={!hasAnyConfig}
      />

      <DataTable
        data={filtered}
        columns={visibleColumns}
        rowKey={(row) => row.poId}
        caption={`Hiển thị ${filtered.length} đơn đặt hàng`}
        flagRow={shouldFlagPoRow}
        onRowClick={navigateToDetail}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />
    </>
  );
}
