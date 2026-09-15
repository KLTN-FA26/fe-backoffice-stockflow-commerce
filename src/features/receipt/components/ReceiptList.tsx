"use client";

import { cn } from "cn";
import { AlertTriangle, ClipboardCheck, Eye, FileText, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ADMIN_ROUTES, RECEIPT_COLUMNS, RECEIPT_STATUSES, STORAGE_KEYS } from "@/constants";

import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";

import { computeReceiptStats, receiptHasDiscrepancy } from "@/features/receipt/selectors";
import { useReceipts } from "@/features/receipt/queries";

import { codeCell, numberCell, statusCell, textCell } from "@/components/shared/column-helpers";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { ListToolbar, type ListSummaryItem } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { Receipt, ReceiptStatus } from "@/features/receipt/types";

type ReceiptColumnKey = (typeof RECEIPT_COLUMNS)[keyof typeof RECEIPT_COLUMNS];
type ReceiptSearchField = "receiptNumber" | "poId" | "supplierId" | "warehouseId" | "receivedBy";

const SEARCH_FIELDS: { label: string; value: ReceiptSearchField }[] = [
  { label: "Mã phiếu nhận", value: "receiptNumber" },
  { label: "PO tham chiếu", value: "poId" },
  { label: "Nhà cung cấp", value: "supplierId" },
  { label: "Kho", value: "warehouseId" },
  { label: "Người nhận", value: "receivedBy" },
];

const STATUS_OPTIONS: { label: string; value: ReceiptStatus }[] = RECEIPT_STATUSES.map(
  (status) => ({
    label: status,
    value: status,
  }),
);

const COLUMN_OPTIONS: { label: string; value: ReceiptColumnKey }[] = [
  { label: "Receipt number", value: RECEIPT_COLUMNS.RECEIPT_NUMBER },
  { label: "PO tham chiếu", value: RECEIPT_COLUMNS.PO_REFERENCE },
  { label: "NCC", value: RECEIPT_COLUMNS.SUPPLIER },
  { label: "Kho", value: RECEIPT_COLUMNS.WAREHOUSE },
  { label: "Số dòng", value: RECEIPT_COLUMNS.LINE_COUNT },
  { label: "ReceiptStatus", value: RECEIPT_COLUMNS.STATUS },
  { label: "Hành động", value: RECEIPT_COLUMNS.ACTIONS },
];

const DEFAULT_CONFIG = {
  showStats: false,
  visibleColumns: [
    RECEIPT_COLUMNS.RECEIPT_NUMBER,
    RECEIPT_COLUMNS.PO_REFERENCE,
    RECEIPT_COLUMNS.SUPPLIER,
    RECEIPT_COLUMNS.WAREHOUSE,
    RECEIPT_COLUMNS.LINE_COUNT,
    RECEIPT_COLUMNS.STATUS,
    RECEIPT_COLUMNS.ACTIONS,
  ],
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

export function ReceiptList() {
  const router = useRouter();
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminReceiptsConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const filters = useUrlFilters(RECEIPT_STATUSES);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const receiptsQuery = useReceipts({
    page: filters.page,
    pageSize: 50,
    q: filters.debouncedQ,
    status: filters.status,
  });

  const receipts = useMemo(() => receiptsQuery.data?.items ?? [], [receiptsQuery.data?.items]);

  const filteredReceipts = useMemo(() => {
    const query = filters.debouncedQ.trim().toLowerCase();
    if (!query) return receipts;

    return receipts.filter((receipt) =>
      config.searchFields.some((field) => String(receipt[field]).toLowerCase().includes(query)),
    );
  }, [config.searchFields, filters.debouncedQ, receipts]);

  const stats = useMemo(() => computeReceiptStats(receipts), [receipts]);

  const columns = useMemo<ColumnDef<Receipt>[]>(
    () => [
      codeCell(
        RECEIPT_COLUMNS.RECEIPT_NUMBER,
        "Receipt number",
        (receipt) => receipt.receiptNumber,
        {
          sortable: true,
          compare: (a, b) => a.receiptNumber.localeCompare(b.receiptNumber),
          onClick: (receipt) => router.push(ADMIN_ROUTES.receipts.detail(receipt.receiptId)),
        },
      ),
      textCell(RECEIPT_COLUMNS.PO_REFERENCE, "PO tham chiếu", (receipt) => receipt.poId, {
        sortable: true,
        compare: (a, b) => a.poId.localeCompare(b.poId),
      }),
      textCell(RECEIPT_COLUMNS.SUPPLIER, "NCC", (receipt) => receipt.supplierId, {
        sortable: true,
        compare: (a, b) => a.supplierId.localeCompare(b.supplierId),
      }),
      textCell(RECEIPT_COLUMNS.WAREHOUSE, "Kho", (receipt) => receipt.warehouseId, {
        sortable: true,
        compare: (a, b) => a.warehouseId.localeCompare(b.warehouseId),
      }),
      numberCell(RECEIPT_COLUMNS.LINE_COUNT, "Số dòng", (receipt) => receipt.lines.length, {
        sortable: true,
        compare: (a, b) => a.lines.length - b.lines.length,
      }),
      statusCell(RECEIPT_COLUMNS.STATUS, "ReceiptStatus", (receipt) => receipt.status, "receipt", {
        sortable: true,
        compare: (a, b) => a.status.localeCompare(b.status),
        withIcon: true,
      }),
      {
        key: RECEIPT_COLUMNS.ACTIONS,
        header: "",
        className: "w-[56px]",
        cell: (receipt) => (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              router.push(ADMIN_ROUTES.receipts.detail(receipt.receiptId));
            }}
            className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] transition-colors"
            aria-label="Xem chi tiết phiếu nhận"
          >
            <Eye className="size-3.5" />
          </Button>
        ),
      },
    ],
    [router],
  );

  const visibleColumns = columns.filter((column) =>
    config.visibleColumns.includes(column.key as ReceiptColumnKey),
  );
  const hasColumnConfig = config.visibleColumns.length !== DEFAULT_CONFIG.visibleColumns.length;
  const hasFieldConfig = config.searchFields.length !== DEFAULT_CONFIG.searchFields.length;
  const hasStatusFilter = filters.status.length > 0;
  const resetDisabled = !filters.q && !hasStatusFilter && !hasColumnConfig && !hasFieldConfig;

  const summaryItems: ListSummaryItem[] = [
    {
      active: Boolean(filters.q),
      clearLabel: "Xoá search chính",
      label: "Search chính",
      onClear: filters.q ? () => filters.setQ("") : undefined,
      value: filters.q || "Chưa nhập",
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
    {
      active: hasStatusFilter,
      clearLabel: "Xoá trạng thái",
      label: "Trạng thái",
      onClear: hasStatusFilter ? () => filters.setStatus([]) : undefined,
      value: filters.status.length ? filters.status.join(", ") : "Tất cả",
    },
  ];

  const toggleStatus = (status: ReceiptStatus) => {
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((item) => item !== status)
        : [...filters.status, status],
    );
  };

  const toggleField = (field: ReceiptSearchField) => {
    updateConfig((current) => ({
      ...current,
      searchFields: current.searchFields.includes(field)
        ? current.searchFields.filter((item) => item !== field)
        : [...current.searchFields, field],
    }));
  };

  const toggleColumn = (column: ReceiptColumnKey) => {
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

  if (receiptsQuery.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PageHeader
        title="Phiếu nhận"
        subtitle="Ghi nhận hàng thực tế về kho theo PO, QC sơ bộ và bàn giao vào inbound area."
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
            <ClipboardCheck className="size-3.5" />
            {config.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
          </Button>
        }
      />

      <ListStatsPanel
        open={config.showStats}
        stats={[
          { icon: FileText, label: "Tổng phiếu", value: stats.total.toLocaleString("vi-VN") },
          { icon: ClipboardCheck, label: "Draft", value: stats.draft.toLocaleString("vi-VN") },
          { icon: PackageCheck, label: "Đang xử lý", value: stats.active.toLocaleString("vi-VN") },
          {
            icon: AlertTriangle,
            label: "Chênh lệch",
            value: stats.discrepancies.toLocaleString("vi-VN"),
          },
        ]}
        gridClassName="sm:grid-cols-4"
      />

      <ListToolbar<ReceiptStatus, ReceiptSearchField, ReceiptColumnKey>
        search={filters.q}
        onSearchChange={filters.setQ}
        searchPlaceholder="Tìm phiếu nhận theo mã, PO, NCC, kho..."
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
        lockedColumns={[RECEIPT_COLUMNS.RECEIPT_NUMBER, RECEIPT_COLUMNS.ACTIONS]}
        visibleColumnCount={visibleColumns.length}
        onToggleColumn={toggleColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_CONFIG.visibleColumns }))
        }
        hasColumnConfig={hasColumnConfig}
        selectedCount={selectedKeys.size}
        bulkDeleteLabel="Xoá đã chọn"
        onBulkDelete={() =>
          toast.warning("Chưa xoá dữ liệu", "Prototype chỉ chọn dòng để thao tác hàng loạt.")
        }
        exportLabel="Xuất Excel"
        onExport={() => toast.success("Xuất Excel", "Đã tạo file phiếu nhận mẫu.")}
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={resetDisabled}
      />

      <DataTable
        data={filteredReceipts}
        columns={visibleColumns}
        rowKey={(receipt) => receipt.receiptId}
        caption={`Hiển thị ${filteredReceipts.length.toLocaleString("vi-VN")} phiếu nhận`}
        flagRow={receiptHasDiscrepancy}
        onRowClick={(receipt) => router.push(ADMIN_ROUTES.receipts.detail(receipt.receiptId))}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pageSize={15}
      />
    </>
  );
}
