"use client";

import { cn } from "cn";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  CircleDollarSign,
  Eye,
  FileText,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ADMIN_ROUTES, INVOICE_COLUMNS, INVOICE_STATUSES, STORAGE_KEYS } from "@/constants";

import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";

import {
  computeInvoiceStats,
  formatCompactCurrency,
  formatMoney,
  shouldFlagInvoiceRow,
} from "@/features/invoice";
import { useInvoices } from "@/features/invoice/queries";

import {
  codeCell,
  dateCell,
  moneyCell,
  statusCell,
  textCell,
} from "@/components/shared/column-helpers";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { ListToolbar, type ListSummaryItem } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { Invoice, InvoiceStatus } from "@/features/invoice/types";

type InvoiceColumnKey = (typeof INVOICE_COLUMNS)[keyof typeof INVOICE_COLUMNS];
type InvoiceSearchField = "invoiceNumber" | "supplierId" | "poId" | "invoiceDate" | "dueDate";

const SEARCH_FIELDS: { label: string; value: InvoiceSearchField }[] = [
  { label: "Số hoá đơn", value: "invoiceNumber" },
  { label: "Nhà cung cấp", value: "supplierId" },
  { label: "PO tham chiếu", value: "poId" },
  { label: "Ngày hoá đơn", value: "invoiceDate" },
  { label: "Hạn thanh toán", value: "dueDate" },
];

const STATUS_OPTIONS: { label: string; value: InvoiceStatus }[] = INVOICE_STATUSES.map(
  (status) => ({
    label: status,
    value: status,
  }),
);

const COLUMN_OPTIONS: { label: string; value: InvoiceColumnKey }[] = [
  { label: "Invoice number", value: INVOICE_COLUMNS.INVOICE_NUMBER },
  { label: "NCC", value: INVOICE_COLUMNS.SUPPLIER },
  { label: "PO tham chiếu", value: INVOICE_COLUMNS.PO_REFERENCE },
  { label: "Ngày hoá đơn", value: INVOICE_COLUMNS.INVOICE_DATE },
  { label: "Hạn thanh toán", value: INVOICE_COLUMNS.DUE_DATE },
  { label: "Tổng tiền", value: INVOICE_COLUMNS.GRAND_TOTAL },
  { label: "InvoiceStatus", value: INVOICE_COLUMNS.STATUS },
  { label: "Hành động", value: INVOICE_COLUMNS.ACTIONS },
];

const DEFAULT_CONFIG = {
  showStats: false,
  visibleColumns: COLUMN_OPTIONS.map((column) => column.value),
  searchFields: SEARCH_FIELDS.map((field) => field.value),
};

function mergeConfig(stored: Partial<typeof DEFAULT_CONFIG>, fallback: typeof DEFAULT_CONFIG) {
  return {
    ...fallback,
    ...stored,
    searchFields: stored.searchFields?.length ? stored.searchFields : fallback.searchFields,
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : fallback.visibleColumns,
  };
}

export function InvoiceList() {
  const router = useRouter();
  const filters = useUrlFilters(INVOICE_STATUSES);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminInvoicesConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const invoicesQuery = useInvoices({
    page: filters.page,
    pageSize: 50,
    q: filters.debouncedQ,
    status: filters.status,
  });
  const invoices = useMemo(() => invoicesQuery.data?.items ?? [], [invoicesQuery.data?.items]);
  const filteredInvoices = useMemo(() => {
    const query = filters.debouncedQ.trim().toLowerCase();
    if (!query) return invoices;
    return invoices.filter((invoice) =>
      config.searchFields.some((field) => String(invoice[field]).toLowerCase().includes(query)),
    );
  }, [config.searchFields, filters.debouncedQ, invoices]);
  const stats = useMemo(() => computeInvoiceStats(filteredInvoices), [filteredInvoices]);

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      codeCell(
        INVOICE_COLUMNS.INVOICE_NUMBER,
        "Invoice number",
        (invoice) => invoice.invoiceNumber,
        {
          sortable: true,
          compare: (a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber),
          onClick: (invoice) => router.push(ADMIN_ROUTES.invoices.detail(invoice.invoiceId)),
        },
      ),
      textCell(INVOICE_COLUMNS.SUPPLIER, "NCC", (invoice) => invoice.supplierId, {
        sortable: true,
        compare: (a, b) => a.supplierId.localeCompare(b.supplierId),
      }),
      textCell(INVOICE_COLUMNS.PO_REFERENCE, "PO tham chiếu", (invoice) => invoice.poId, {
        sortable: true,
        compare: (a, b) => a.poId.localeCompare(b.poId),
      }),
      dateCell(INVOICE_COLUMNS.INVOICE_DATE, "Ngày hoá đơn", (invoice) => invoice.invoiceDate, {
        sortable: true,
        compare: (a, b) => a.invoiceDate.localeCompare(b.invoiceDate),
      }),
      dateCell(INVOICE_COLUMNS.DUE_DATE, "Hạn thanh toán", (invoice) => invoice.dueDate, {
        sortable: true,
        compare: (a, b) => a.dueDate.localeCompare(b.dueDate),
      }),
      moneyCell(
        INVOICE_COLUMNS.GRAND_TOTAL,
        "Tổng tiền",
        (invoice) => invoice.grandTotal,
        (amount) => formatMoney(amount, "VND"),
        { sortable: true, compare: (a, b) => a.grandTotal - b.grandTotal },
      ),
      statusCell(INVOICE_COLUMNS.STATUS, "InvoiceStatus", (invoice) => invoice.status, "invoice", {
        sortable: true,
        compare: (a, b) => a.status.localeCompare(b.status),
        withIcon: true,
      }),
      {
        key: INVOICE_COLUMNS.ACTIONS,
        header: "",
        className: "w-[56px]",
        cell: (invoice) => (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Xem chi tiết hoá đơn"
            onClick={(event) => {
              event.stopPropagation();
              router.push(ADMIN_ROUTES.invoices.detail(invoice.invoiceId));
            }}
            className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          >
            <Eye className="size-3.5" />
          </Button>
        ),
      },
    ],
    [router],
  );

  const visibleColumns = columns.filter((column) =>
    config.visibleColumns.includes(column.key as InvoiceColumnKey),
  );
  const hasStatusFilter = filters.status.length > 0;
  const hasColumnConfig = config.visibleColumns.length !== DEFAULT_CONFIG.visibleColumns.length;
  const hasFieldConfig = config.searchFields.length !== DEFAULT_CONFIG.searchFields.length;
  const hasGlobalSearch = Boolean(filters.q);
  const resetDisabled = !hasStatusFilter && !hasColumnConfig && !hasFieldConfig && !hasGlobalSearch;

  const summaryItems: ListSummaryItem[] = [
    {
      active: hasGlobalSearch,
      clearLabel: "Xoá search chính",
      label: "Search chính",
      onClear: hasGlobalSearch ? () => filters.setQ("") : undefined,
      value: filters.q || "Chưa nhập",
    },
    {
      active: hasStatusFilter,
      clearLabel: "Xoá trạng thái",
      label: "Trạng thái",
      onClear: hasStatusFilter ? () => filters.setStatus([]) : undefined,
      value: filters.status.length ? filters.status.join(", ") : "Tất cả",
    },
    {
      active: hasFieldConfig,
      clearLabel: "Đặt lại trường search",
      label: "Trường search",
      onClear: hasFieldConfig
        ? () =>
            updateConfig((current) => ({ ...current, searchFields: DEFAULT_CONFIG.searchFields }))
        : undefined,
      value: `${config.searchFields.length}/${SEARCH_FIELDS.length}`,
    },
    {
      active: hasColumnConfig,
      clearLabel: "Đặt lại cột hiển thị",
      label: "Cột hiển thị",
      onClear: hasColumnConfig
        ? () =>
            updateConfig((current) => ({
              ...current,
              visibleColumns: DEFAULT_CONFIG.visibleColumns,
            }))
        : undefined,
      value: `${visibleColumns.length}/${columns.length}`,
    },
  ];

  const toggleStatus = (status: InvoiceStatus) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((item) => item !== status)
        : [...filters.status, status],
    );
  const toggleField = (field: InvoiceSearchField) =>
    updateConfig((current) => ({
      ...current,
      searchFields: current.searchFields.includes(field)
        ? current.searchFields.filter((item) => item !== field)
        : [...current.searchFields, field],
    }));
  const toggleColumn = (column: InvoiceColumnKey) => {
    if (column === INVOICE_COLUMNS.INVOICE_NUMBER || column === INVOICE_COLUMNS.ACTIONS) return;
    updateConfig((current) => ({
      ...current,
      visibleColumns: current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column],
    }));
  };
  const resetAll = () => {
    filters.reset();
    updateConfig((current) => ({
      ...current,
      searchFields: DEFAULT_CONFIG.searchFields,
      visibleColumns: DEFAULT_CONFIG.visibleColumns,
    }));
  };

  if (invoicesQuery.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PageHeader
        title="Hoá đơn NCC"
        subtitle="Đối chiếu hoá đơn nhà cung cấp với PO, Receipt và duyệt thanh toán."
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
        open={config.showStats}
        stats={[
          { icon: FileText, label: "Tổng hoá đơn", value: stats.total.toLocaleString("vi-VN") },
          {
            icon: CircleDollarSign,
            label: "Tổng giá trị VND",
            value: formatCompactCurrency(stats.totalValueVND, "VND"),
          },
          {
            icon: CheckCircle,
            label: "Đã khớp",
            value: formatCompactCurrency(stats.valueByStatus.Matched?.VND ?? 0, "VND"),
          },
          {
            icon: AlertTriangle,
            label: "Ngoại lệ",
            value: formatCompactCurrency(stats.valueByStatus.Exception?.VND ?? 0, "VND"),
          },
          {
            icon: Wallet,
            label: "Đã thanh toán",
            value: formatCompactCurrency(stats.valueByStatus.Paid?.VND ?? 0, "VND"),
          },
        ]}
        gridClassName="sm:grid-cols-2 lg:grid-cols-5"
      />
      <ListToolbar<InvoiceStatus, InvoiceSearchField, InvoiceColumnKey>
        search={filters.q}
        onSearchChange={filters.setQ}
        searchPlaceholder="Tìm hoá đơn theo số, NCC, PO..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={filters.status}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => filters.setStatus([])}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={SEARCH_FIELDS}
        selectedFields={config.searchFields}
        defaultFields={DEFAULT_CONFIG.searchFields}
        onToggleField={toggleField}
        onResetFields={() =>
          updateConfig((current) => ({ ...current, searchFields: DEFAULT_CONFIG.searchFields }))
        }
        onSelectAllFields={() =>
          updateConfig((current) => ({
            ...current,
            searchFields: SEARCH_FIELDS.map((field) => field.value),
          }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={COLUMN_OPTIONS}
        selectedColumns={config.visibleColumns}
        defaultColumns={DEFAULT_CONFIG.visibleColumns}
        lockedColumns={[INVOICE_COLUMNS.INVOICE_NUMBER, INVOICE_COLUMNS.ACTIONS]}
        visibleColumnCount={visibleColumns.length}
        onToggleColumn={toggleColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_CONFIG.visibleColumns }))
        }
        hasColumnConfig={hasColumnConfig}
        selectedCount={selectedKeys.size}
        onBulkDelete={() =>
          toast.warning("Chưa xoá dữ liệu", "Prototype chỉ chọn dòng để thao tác hàng loạt.")
        }
        onExport={() => toast.success("Xuất Excel", "Đã tạo file hoá đơn mẫu.")}
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={resetDisabled}
      />
      <DataTable
        data={filteredInvoices}
        columns={visibleColumns}
        rowKey={(invoice) => invoice.invoiceId}
        caption={`Hiển thị ${filteredInvoices.length.toLocaleString("vi-VN")} hoá đơn`}
        flagRow={shouldFlagInvoiceRow}
        onRowClick={(invoice) => router.push(ADMIN_ROUTES.invoices.detail(invoice.invoiceId))}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />
    </>
  );
}
