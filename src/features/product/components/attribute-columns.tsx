"use client";

import { Eye } from "lucide-react";

import { CELL, codeCell, EmptyCell, nameCell, textCell } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";
import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";

import { ActiveDot } from "../active-status";
import { DATA_TYPE_LABEL } from "../attribute-labels";
import { ATTRIBUTE_DATA_TYPES } from "../attribute-schemas";
import { textIncludes } from "@/lib/text-match";
import { ATTRIBUTE_ACTIVE_FILTERS, ATTRIBUTE_ACTIVE_LABEL } from "./AttributeFilterPopover";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Attribute } from "../attribute-schemas";
import type { AttributeListState } from "./useAttributeListState";

export const ATTRIBUTE_COLUMNS = [
  "code",
  "name",
  "dataType",
  "unit",
  "values",
  "active",
  "actions",
] as const;
export type AttributeColumnKey = (typeof ATTRIBUTE_COLUMNS)[number];

export const ATTRIBUTE_COLUMN_LABELS: Record<AttributeColumnKey, string> = {
  code: "Mã",
  name: "Tên",
  dataType: "Loại",
  unit: "Đơn vị",
  values: "Giá trị",
  active: "Trạng thái",
  actions: "Thao tác",
};

export const DATA_TYPE_OPTIONS = ATTRIBUTE_DATA_TYPES.map((value) => ({
  value,
  label: DATA_TYPE_LABEL[value],
}));
export const ACTIVE_OPTIONS = ATTRIBUTE_ACTIVE_FILTERS.map((value) => ({
  value,
  label: ATTRIBUTE_ACTIVE_LABEL[value],
}));

/** Thuộc tính khớp ô lọc cột Mã / Tên (bỏ dấu, rỗng = không lọc cột đó). */
export function matchesAttributeColumns(
  attribute: Attribute,
  search: { code: string; name: string },
): boolean {
  return textIncludes(attribute.code, search.code) && textIncludes(attribute.name, search.name);
}

export function attributeColumns(
  onOpen: (attribute: Attribute) => void,
): (ColumnDef<Attribute> & { key: AttributeColumnKey })[] {
  return [
    {
      ...codeCell<Attribute>("code", "Mã", (row) => row.code, {
        sortable: true,
        compare: (a, b) => a.code.localeCompare(b.code),
      }),
      key: "code",
      className: "min-w-32",
    },
    {
      ...nameCell<Attribute>("name", "Tên", (row) => row.name, {
        sortable: true,
        compare: (a, b) => a.name.localeCompare(b.name),
      }),
      key: "name",
      className: "min-w-40",
    },
    {
      ...textCell<Attribute>("dataType", "Loại", (row) => DATA_TYPE_LABEL[row.dataType]),
      key: "dataType",
      className: "min-w-28",
    },
    { ...textCell<Attribute>("unit", "Đơn vị", (row) => row.unit ?? ""), key: "unit" },
    {
      key: "values",
      header: "Giá trị",
      align: "right",
      cell: (row) =>
        row.values.length > 0 ? (
          <span className={CELL.number}>{row.values.length}</span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: "active",
      header: "Trạng thái",
      className: "min-w-32",
      cell: (row) => <ActiveDot active={row.active} />,
    },
    {
      ...rowActionsColumn<Attribute>((row) => ({
        label: `Thao tác — ${row.code}`,
        actions: [{ label: "Xem chi tiết", icon: Eye, onSelect: () => onOpen(row) }],
      })),
      key: "actions",
    },
  ];
}

/**
 * Nút lọc trên header bảng thuộc tính — ghi vào cùng URL state với bảng "Bộ lọc":
 * Mã / Tên → `attrCode` / `attrName`; Loại → `dataType`, Trạng thái → `active` (BE nhận một giá trị
 * mỗi tham số nên chọn một).
 */
export function attributeHeaderFilters(
  state: AttributeListState,
): Partial<Record<AttributeColumnKey, ReactNode>> {
  return {
    code: (
      <ColumnFilterButton
        label="mã"
        value={state.code}
        placeholder="Tìm theo mã…"
        onChange={(value) => void state.setCode(value || null)}
      />
    ),
    name: (
      <ColumnFilterButton
        label="tên"
        value={state.name}
        placeholder="Tìm theo tên…"
        onChange={(value) => void state.setName(value || null)}
      />
    ),
    dataType: (
      <HeaderOptionFilter
        label="loại"
        value={state.dataType}
        options={DATA_TYPE_OPTIONS}
        onChange={(value) =>
          void state.setDataType(ATTRIBUTE_DATA_TYPES.find((t) => t === value) ?? null)
        }
        searchPlaceholder="Tìm loại…"
        emptyLabel="Không có loại"
      />
    ),
    active: (
      <HeaderOptionFilter
        label="trạng thái"
        value={state.active}
        options={ACTIVE_OPTIONS}
        onChange={(value) =>
          void state.setActive(ATTRIBUTE_ACTIVE_FILTERS.find((a) => a === value) ?? null)
        }
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };
}
