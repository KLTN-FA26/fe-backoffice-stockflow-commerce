"use client";

import { DataTable } from "@/components/shared/DataTable";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { shouldFlagPoRow } from "@/features/purchase-order";

import type { PurchaseOrder } from "@/features/purchase-order";
import type { STATUS_OPTIONS } from "./config";
import type { ListSummaryItem } from "@/components/shared/ListToolbar";

export function PoListTable({
  search,
  onSearchChange,
  statusProps,
  fieldProps,
  columnProps,
  selectedCount,
  onBulkDelete,
  onExport,
  summaryItems,
  onResetAll,
  resetDisabled,
  filtered,
  visibleColumns,
  onRowClick,
  selectedKeys,
  onSelectionChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusProps: {
    options: typeof STATUS_OPTIONS;
    selected: readonly string[];
    onToggle: (v: string) => void;
    onClear: () => void;
    hasFilter: boolean;
  };
  fieldProps: {
    options: readonly never[] | readonly { label: string; value: string }[];
    selected: readonly string[];
    defaults: readonly string[];
    onToggle: (v: string) => void;
    onReset: () => void;
    onSelectAll: () => void;
    hasConfig: boolean;
  };
  columnProps: {
    options: readonly { label: string; value: string }[];
    selected: readonly string[];
    defaults: readonly string[];
    locked: readonly string[];
    count: number;
    onToggle: (v: string) => void;
    onReset: () => void;
    hasConfig: boolean;
  };
  selectedCount: number;
  onBulkDelete: () => void;
  onExport: () => void;
  summaryItems: readonly ListSummaryItem[];
  onResetAll: () => void;
  resetDisabled: boolean;
  filtered: readonly PurchaseOrder[];
  visibleColumns: readonly never[] | readonly { key: string }[];
  onRowClick: (r: PurchaseOrder) => void;
  selectedKeys: Set<string>;
  onSelectionChange: (s: Set<string>) => void;
}) {
  return (
    <>
      <ListToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Tìm PO theo mã, NCC, kho..."
        statusOptions={statusProps.options as never}
        selectedStatuses={statusProps.selected as never}
        onToggleStatus={statusProps.onToggle as never}
        onClearStatuses={statusProps.onClear}
        hasStatusFilter={statusProps.hasFilter}
        fieldOptions={fieldProps.options as never}
        selectedFields={fieldProps.selected as never}
        defaultFields={fieldProps.defaults as never}
        onToggleField={fieldProps.onToggle as never}
        onResetFields={fieldProps.onReset}
        onSelectAllFields={fieldProps.onSelectAll}
        hasFieldConfig={fieldProps.hasConfig}
        columnOptions={columnProps.options as never}
        selectedColumns={columnProps.selected as never}
        defaultColumns={columnProps.defaults as never}
        lockedColumns={columnProps.locked as never}
        visibleColumnCount={columnProps.count}
        onToggleColumn={columnProps.onToggle as never}
        onResetColumns={columnProps.onReset}
        hasColumnConfig={columnProps.hasConfig}
        selectedCount={selectedCount}
        onBulkDelete={onBulkDelete}
        onExport={onExport}
        summaryItems={summaryItems as never}
        onResetAll={onResetAll}
        resetDisabled={resetDisabled}
      />
      <DataTable
        data={filtered as never}
        columns={visibleColumns as never}
        rowKey={(r: PurchaseOrder) => r.poId}
        caption={`Hiển thị ${filtered.length} đơn đặt hàng`}
        flagRow={shouldFlagPoRow as never}
        onRowClick={onRowClick as never}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        pageSize={15}
      />
    </>
  );
}
