"use client";

import { UI_LABELS } from "@/constants";
import {
  ListFilterColumn,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";

import { DATA_TYPE_LABEL } from "../attribute-labels";
import {
  ACTIVE_OPTIONS,
  ATTRIBUTE_COLUMN_LABELS,
  ATTRIBUTE_COLUMNS,
  DATA_TYPE_OPTIONS,
  type AttributeColumnKey,
} from "./attribute-columns";
import { ATTRIBUTE_ACTIVE_LABEL } from "./AttributeFilterPopover";

import type { AttributeListState } from "./useAttributeListState";

const HIDEABLE = ATTRIBUTE_COLUMNS.filter((column) => column !== "actions");

/**
 * Hàng tìm kiếm + thanh cấu hình kiểu Vercel (`controlsIn="summary"`) của danh sách thuộc tính: nút
 * "Bộ lọc" (Loại, Trạng thái — chọn một vì BE nhận một giá trị, bấm lại để bỏ) và "Ẩn hiện cột"
 * (cột "Thao tác" luôn hiện), các viên lọc đang dùng và "Đặt lại".
 */
export function AttributeListToolbar({
  state,
  columns,
  onColumnsChange,
}: {
  state: AttributeListState;
  columns: readonly AttributeColumnKey[];
  onColumnsChange: (columns: AttributeColumnKey[]) => void;
}) {
  const visibleCount = columns.filter((column) => column !== "actions").length;
  const hasColumnConfig = visibleCount !== HIDEABLE.length;
  const summaryItems: ListSummaryItem[] = [
    {
      label: "Loại",
      value: state.dataType ? DATA_TYPE_LABEL[state.dataType] : UI_LABELS.taxonomy.allStatuses,
      active: state.dataType !== null,
      onClear: () => void state.setDataType(null),
      clearLabel: "Xoá lọc loại",
    },
    {
      label: "Trạng thái",
      value: state.active ? ATTRIBUTE_ACTIVE_LABEL[state.active] : UI_LABELS.taxonomy.allStatuses,
      active: state.active !== null,
      onClear: () => void state.setActive(null),
      clearLabel: "Xoá lọc trạng thái",
    },
    {
      label: "Mã",
      value: state.code ? `“${state.code}”` : UI_LABELS.common.notEntered,
      active: state.code !== "",
      onClear: () => void state.setCode(null),
      clearLabel: "Xoá lọc mã",
    },
    {
      label: "Tên",
      value: state.name ? `“${state.name}”` : UI_LABELS.common.notEntered,
      active: state.name !== "",
      onClear: () => void state.setName(null),
      clearLabel: "Xoá lọc tên",
    },
    {
      label: "Tìm kiếm chính",
      value: state.q ? `“${state.q}”` : UI_LABELS.common.notEntered,
      active: state.q !== "",
      onClear: () => void state.setQ(null),
      clearLabel: "Xoá search chính",
    },
    {
      label: "Cột hiển thị",
      value: `${visibleCount}/${HIDEABLE.length}`,
      active: hasColumnConfig,
      onClear: () => onColumnsChange([...ATTRIBUTE_COLUMNS]),
    },
  ];
  const hasPanelFilter = state.dataType !== null || state.active !== null;

  return (
    <ListToolbar
      search={state.q}
      onSearchChange={(value) => void state.setQ(value || null)}
      searchPlaceholder="Tìm theo mã hoặc tên…"
      columnOptions={HIDEABLE.map((column) => ({
        label: ATTRIBUTE_COLUMN_LABELS[column],
        value: column,
      }))}
      selectedColumns={[...columns]}
      defaultColumns={[...ATTRIBUTE_COLUMNS]}
      lockedColumns={["actions"]}
      visibleColumnCount={visibleCount}
      onToggleColumn={(column) =>
        column !== "actions" &&
        onColumnsChange(
          columns.includes(column)
            ? columns.filter((item) => item !== column)
            : [...columns, column],
        )
      }
      onResetColumns={() => onColumnsChange([...ATTRIBUTE_COLUMNS])}
      hasColumnConfig={hasColumnConfig}
      summaryItems={summaryItems}
      onResetAll={() => {
        state.resetAll();
        onColumnsChange([...ATTRIBUTE_COLUMNS]);
      }}
      resetDisabled={!hasPanelFilter && !state.q && !state.code && !state.name && !hasColumnConfig}
      hasPanelFilter={hasPanelFilter}
      onClearPanelFilters={() => {
        void state.setDataType(null);
        void state.setActive(null);
      }}
      filterPanel={
        <>
          <ListFilterColumn
            title="Loại"
            searchPlaceholder="Tìm loại..."
            emptyText="Không có loại phù hợp."
            options={DATA_TYPE_OPTIONS}
            isChecked={(value) => state.dataType === value}
            onSelect={(value) => void state.setDataType(state.dataType === value ? null : value)}
          />
          <ListFilterColumn
            title="Trạng thái"
            searchPlaceholder="Tìm trạng thái..."
            emptyText="Không có trạng thái phù hợp."
            options={ACTIVE_OPTIONS}
            isChecked={(value) => state.active === value}
            onSelect={(value) => void state.setActive(state.active === value ? null : value)}
          />
        </>
      }
      controlsIn="summary"
    />
  );
}
