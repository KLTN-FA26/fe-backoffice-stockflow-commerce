"use client";

import { UI_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { TAXONOMY_STATUS_LABEL, TAXONOMY_STATUS_OPTIONS } from "./taxonomy-header-filters";

import type { ReactNode } from "react";
import type { TaxonomyListState, TaxonomyStatusFilter } from "./useTaxonomyListState";

const L = UI_LABELS.taxonomy;

/**
 * Toolbar data-table Mode A cho hai tab (kiểu Vercel, như trang Sản phẩm): hàng tìm kiếm chỉ còn ô
 * tìm theo mã / tên; nút "Bộ lọc" (trạng thái — BE nhận MỘT `active` nên là chọn một) + "Ẩn hiện cột"
 * nằm đầu thanh cấu hình (`controlsIn="summary"`). Nút tạo mới nằm trên topbar (`TaxonomyManager`).
 */
export function TaxonomyToolbar({
  s,
  searchPlaceholder,
  columnLabels,
  lockedColumn,
  tools,
}: {
  s: TaxonomyListState;
  searchPlaceholder: string;
  columnLabels: Record<string, string>;
  lockedColumn: string;
  /** Công cụ riêng của tab (mở / thu gọn cây danh mục). */
  tools?: ReactNode;
}) {
  const allColumns = Object.keys(columnLabels);
  return (
    <ListToolbar<TaxonomyStatusFilter, string, string>
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={searchPlaceholder}
      statusOptions={TAXONOMY_STATUS_OPTIONS}
      // Trạng thái đã lọc được trên header cột → không thêm nút chọn nhanh
      statusInHeader
      selectedStatuses={s.status ? [s.status] : []}
      onToggleStatus={(value) => s.setStatus(s.status === value ? null : value)}
      onClearStatuses={() => s.setStatus(null)}
      hasStatusFilter={Boolean(s.status)}
      columnOptions={allColumns.map((value) => ({ value, label: columnLabels[value] ?? value }))}
      selectedColumns={s.config.visibleColumns}
      defaultColumns={allColumns}
      lockedColumns={[lockedColumn]}
      visibleColumnCount={s.config.visibleColumns.length}
      onToggleColumn={s.toggleColumn}
      onResetColumns={s.resetColumns}
      hasColumnConfig={s.hasColumnConfig}
      tools={tools}
      summaryItems={[
        {
          label: "Tìm kiếm chính",
          value: s.q || "Chưa dùng",
          active: Boolean(s.q),
          onClear: () => s.setQ(""),
        },
        {
          label: L.field.active,
          value: s.status ? TAXONOMY_STATUS_LABEL[s.status] : L.allStatuses,
          active: Boolean(s.status),
          onClear: () => s.setStatus(null),
        },
        {
          label: L.field.code,
          value: s.code || "Chưa nhập",
          active: Boolean(s.code),
          onClear: () => s.setCode(""),
        },
        {
          label: L.field.name,
          value: s.name || "Chưa nhập",
          active: Boolean(s.name),
          onClear: () => s.setName(""),
        },
        {
          label: "Cột hiển thị",
          value: `${s.config.visibleColumns.length}/${allColumns.length}`,
          active: s.hasColumnConfig,
          onClear: s.resetColumns,
        },
      ]}
      onResetAll={() => {
        s.resetFilters();
        s.resetColumns();
      }}
      // Đang gõ (chưa qua debounce) cũng tính là có lọc để "Đặt lại" bấm được ngay
      resetDisabled={!s.filtered && !s.code && !s.name && !s.q && !s.hasColumnConfig}
      controlsIn="summary"
    />
  );
}
