"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Eye, Plus, Star, Truck, Users } from "lucide-react";
import { cn } from "cn";

import { ADMIN_ROUTES, STORAGE_KEYS, SUPPLIER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel, type ListStatItem } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { textCell, statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { computeSupplierStats, useSuppliers } from "@/features/supplier";
import type { SupplierDto, SupplierStatus } from "@/features/supplier";

/* ── Constants ────────────────────────────────────────────────────────── */

interface SupplierPageConfig {
  showStats: boolean;
  statuses: SupplierStatus[];
  globalSearch: { query: string; fields: string[] };
  columnSearch: Partial<Record<"supplierId" | "name" | "taxCode", string>>;
  visibleColumns: string[];
}

const DEFAULT_COLUMNS = [
  "supplierId",
  "name",
  "taxCode",
  "contact",
  "leadTimeDays",
  "rating",
  "status",
  "actions",
];
const DEFAULT_CONFIG: SupplierPageConfig = {
  showStats: false,
  statuses: [],
  globalSearch: { query: "", fields: ["supplierId", "name"] },
  columnSearch: {},
  visibleColumns: DEFAULT_COLUMNS,
};

const SEARCH_FIELDS = [
  { label: "Mã NCC", value: "supplierId", getValue: (s: SupplierDto) => s.supplierId },
  { label: "Tên", value: "name", getValue: (s: SupplierDto) => s.name },
  { label: "Mã thuế", value: "taxCode", getValue: (s: SupplierDto) => s.taxCode },
  { label: "Email", value: "contactEmail", getValue: (s: SupplierDto) => s.contactEmail },
];

const COLUMN_LABELS: Record<string, string> = {
  supplierId: "Mã NCC",
  name: "Tên nhà cung cấp",
  taxCode: "Mã thuế",
  contact: "Liên hệ",
  leadTimeDays: "Lead time",
  rating: "Đánh giá",
  status: "Trạng thái",
  actions: "Thao tác",
};

const STATUS_LABELS: Record<SupplierStatus, string> = {
  Active: "Đang hoạt động",
  Inactive: "Ngừng hoạt động",
};

const STATUS_OPTIONS: { label: string; value: SupplierStatus }[] = Object.entries(
  STATUS_LABELS,
).map(([value, label]) => ({ label, value: value as SupplierStatus }));

function mergeStoredConfig(
  stored: Partial<SupplierPageConfig>,
  fallback: SupplierPageConfig,
): SupplierPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_COLUMNS,
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/* ── Component ────────────────────────────────────────────────────────── */

export function SupplierList() {
  const router = useRouter();
  const filters = useUrlFilters(SUPPLIER_STATUSES);
  const { config, updateConfig } = usePageConfig<SupplierPageConfig>(
    STORAGE_KEYS.adminSuppliersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );

  const suppliersQuery = useSuppliers({ page: 1, pageSize: 500 });
  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);

  const pageConfig = useMemo(
    () => ({
      ...config,
      statuses: filters.status.length > 0 ? filters.status : [],
      globalSearch: { ...config.globalSearch, query: filters.q },
    }),
    [config, filters.status, filters.q],
  );

  const navigateToDetail = (supplier: SupplierDto) =>
    router.push(`${ADMIN_ROUTES.suppliers}/${supplier.supplierId}`);

  const toggleStatus = (status: SupplierStatus) => {
    const next = filters.status.includes(status)
      ? filters.status.filter((item) => item !== status)
      : [...filters.status, status];
    filters.setStatus(next);
  };

  const toggleSearchField = (field: string) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return { ...current, globalSearch: { ...current.globalSearch, fields } };
    });
  };

  const toggleTableColumn = (column: string) => {
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

  const updateColumnSearch = (key: "supplierId" | "name" | "taxCode", value: string) =>
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  const clearColumnSearch = () => updateConfig((current) => ({ ...current, columnSearch: {} }));

  const filtered = useMemo(() => {
    let list = suppliers;
    if (pageConfig.statuses.length > 0)
      list = list.filter((s) => pageConfig.statuses.includes(s.status));

    const q = normalize(pageConfig.globalSearch.query);
    if (q && pageConfig.globalSearch.fields.length > 0) {
      const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((s) =>
        pageConfig.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(s) ?? "").includes(q),
        ),
      );
    }

    const idQuery = normalize(pageConfig.columnSearch.supplierId ?? "");
    if (idQuery) list = list.filter((s) => normalize(s.supplierId).includes(idQuery));
    const nameQuery = normalize(pageConfig.columnSearch.name ?? "");
    if (nameQuery) list = list.filter((s) => normalize(s.name).includes(nameQuery));
    const taxQuery = normalize(pageConfig.columnSearch.taxCode ?? "");
    if (taxQuery) list = list.filter((s) => normalize(s.taxCode).includes(taxQuery));

    return list;
  }, [pageConfig, suppliers]);

  const stats = useMemo(() => {
    const cable = computeSupplierStats(filtered);
    return [
      { label: "Tổng NCC", value: cable.total.toString(), icon: Users },
      { label: "Đang hoạt động", value: cable.active.toString(), icon: Truck },
      { label: "Ngừng hoạt động", value: cable.inactive.toString(), icon: BarChart3 },
      { label: "Tỷ lệ hoạt động", value: `${cable.activeRate}%`, icon: Star },
    ] as ListStatItem[];
  }, [filtered]);

  const hasStatusFilter = pageConfig.statuses.length > 0;
  const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
  const activeColumnSearch = Object.entries(pageConfig.columnSearch).filter(([, value]) =>
    value?.trim(),
  );
  const hasFieldConfig =
    pageConfig.globalSearch.fields.length !== DEFAULT_CONFIG.globalSearch.fields.length ||
    pageConfig.globalSearch.fields.some(
      (field) => !DEFAULT_CONFIG.globalSearch.fields.includes(field),
    );
  const visibleColumnCount = pageConfig.visibleColumns.filter(
    (column) => column !== "actions",
  ).length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasGlobalSearch ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    pageConfig.showStats ||
    hasColumnConfig;

  const columns: (ColumnDef<SupplierDto> & { key: string })[] = [
    {
      key: "supplierId",
      header: "Mã NCC",
      sortable: true,
      compare: (a, b) => a.supplierId.localeCompare(b.supplierId),
      headerFilter: (
        <ColumnFilterButton
          value={pageConfig.columnSearch.supplierId ?? ""}
          label="Mã NCC"
          placeholder="Lọc mã NCC"
          onChange={(value) => updateColumnSearch("supplierId", value)}
        />
      ),
      cell: (row) => (
        <Link
          href={`${ADMIN_ROUTES.suppliers}/${row.supplierId}`}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => {
            event.preventDefault();
            navigateToDetail(row);
          }}
        >
          {row.supplierId}
        </Link>
      ),
    },
    {
      ...textCell<SupplierDto>("name", "Tên nhà cung cấp", (row) => row.name, {
        sortable: true,
        compare: (a, b) => a.name.localeCompare(b.name),
        color: "primary",
      }),
      key: "name",
      headerFilter: (
        <ColumnFilterButton
          value={pageConfig.columnSearch.name ?? ""}
          label="Tên"
          placeholder="Lọc tên NCC"
          onChange={(value) => updateColumnSearch("name", value)}
        />
      ),
    },
    textCell<SupplierDto>("taxCode", "Mã thuế", (row) => row.taxCode, {
      sortable: true,
      compare: (a, b) => a.taxCode.localeCompare(b.taxCode),
      color: "primary",
    }) as ColumnDef<SupplierDto> & { key: string },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-[0.8125rem]">
          <div className="text-ink-primary">{row.contactName}</div>
          <div className="text-ink-secondary">{row.contactPhone}</div>
        </div>
      ),
    },
    {
      key: "leadTimeDays",
      header: "Lead time",
      align: "right",
      sortable: true,
      compare: (a, b) => a.leadTimeDays - b.leadTimeDays,
      cell: (row) => <span className="tabular-nums">{row.leadTimeDays} ngày</span>,
    },
    {
      key: "rating",
      header: "Đánh giá",
      align: "right",
      sortable: true,
      compare: (a, b) => a.rating - b.rating,
      cell: (row) => <span className="tabular-nums">{row.rating.toFixed(1)}</span>,
    },
    statusCell<SupplierDto>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<SupplierDto> & { key: string },
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
  const columnOptions = DEFAULT_COLUMNS.filter((column) => column !== "actions").map((column) => ({
    label: COLUMN_LABELS[column],
    value: column,
  }));
  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value:
        pageConfig.statuses.map((status) => STATUS_LABELS[status] ?? status).join(", ") || "Tất cả",
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
            .map(([key, value]) => `${COLUMN_LABELS[key] ?? key} “${value}”`)
            .join(", ")
        : "Chưa dùng",
      active: activeColumnSearch.length > 0,
      onClear: clearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: `${visibleColumnCount}/${DEFAULT_COLUMNS.length - 1}`,
      active: hasColumnConfig,
      onClear: () => updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];

  const navigateToCreate = () => router.push(`${ADMIN_ROUTES.suppliers}/create`);

  if (suppliersQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

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
              size="sm"
              onClick={navigateToCreate}
              className="rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Thêm nhà cung cấp
            </Button>
          </div>
        }
      />

      <ListStatsPanel open={pageConfig.showStats} stats={stats} />

      <ListToolbar
        search={filters.q}
        onSearchChange={(value) => filters.setQ(value)}
        searchPlaceholder="Tìm NCC theo mã, tên, mã thuế..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={filters.status}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => filters.setStatus([])}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={SEARCH_FIELDS.map(({ label, value }) => ({ label, value }))}
        selectedFields={pageConfig.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={toggleSearchField}
        hasFieldConfig={hasFieldConfig}
        columnOptions={columnOptions}
        selectedColumns={pageConfig.visibleColumns}
        defaultColumns={DEFAULT_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_COLUMNS }))
        }
        hasColumnConfig={hasColumnConfig}
        onExport={() => {}}
        summaryItems={summaryItems}
        onResetAll={() => {
          updateConfig(() => DEFAULT_CONFIG);
          filters.reset();
        }}
        resetDisabled={!hasAnyConfig}
      />

      <DataTable
        columns={visibleColumns}
        data={filtered}
        rowKey={(s) => s.supplierId}
        onRowClick={navigateToDetail}
        flagRow={(s) => s.status === "Inactive"}
        pageSizeOptions={[10, 15, 20, 50]}
      />
    </>
  );
}
