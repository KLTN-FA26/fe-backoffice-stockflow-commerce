"use client";

import { useMemo, useState } from "react";

import { Pencil, Trash2 } from "lucide-react";

import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { CELL } from "@/components/shared/column-helpers";
import {
  ColumnFilterButton,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

import { ActiveDot } from "../active-status";
import { textIncludes } from "@/lib/text-match";
import { ACTIVE_OPTIONS } from "./attribute-columns";

import type { AttributeValue } from "../attribute-schemas";

/**
 * Bảng giá trị của một thuộc tính trong panel chi tiết. Nằm trong `DetailPanel` nên bỏ khung riêng
 * (không khung lồng khung). BE trả cả bộ giá trị cùng thuộc tính → lọc theo cột ở FE.
 */
export function AttributeValuesTable({
  values,
  canUpdate,
  onEdit,
  onDelete,
}: {
  values: readonly AttributeValue[];
  canUpdate: boolean;
  onEdit: (value: AttributeValue) => void;
  onDelete: (value: AttributeValue) => void;
}) {
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      values.filter(
        (v) =>
          textIncludes(v.label, label) &&
          textIncludes(v.code, code) &&
          (active === null || String(v.active) === active),
      ),
    [values, label, code, active],
  );

  const columns: ColumnDef<AttributeValue>[] = [
    {
      key: "label",
      header: "Nhãn",
      className: "min-w-36",
      cell: (v) => (
        <span className="text-ink-primary inline-flex items-center gap-2 font-medium">
          {v.hexColor && (
            <span
              aria-hidden
              className="border-border-default size-4 shrink-0 rounded-full border"
              style={{ backgroundColor: v.hexColor }}
            />
          )}
          {v.label}
        </span>
      ),
    },
    {
      key: "code",
      header: "Mã",
      className: "min-w-28",
      cell: (v) => <span className={CELL.code}>{v.code}</span>,
    },
    {
      key: "active",
      header: "Trạng thái",
      className: "min-w-32",
      cell: (v) => <ActiveDot active={v.active} />,
    },
  ];
  if (canUpdate) {
    columns.push({
      key: "actions",
      header: "Thao tác",
      className: "w-20",
      align: "right",
      cell: (v) => (
        <RowActionsMenu
          label={`Thao tác — ${v.code}`}
          actions={[
            { label: "Sửa giá trị", icon: Pencil, onSelect: () => onEdit(v) },
            { label: "Xoá giá trị", icon: Trash2, onSelect: () => onDelete(v), danger: true },
          ]}
        />
      ),
    });
  }

  const filtering = Boolean(label.trim() || code.trim() || active);
  return (
    <DataTable
      className="rounded-none border-0 shadow-none"
      data={rows}
      columns={withHeaderFilters(columns, {
        label: (
          <ColumnFilterButton
            label="nhãn"
            value={label}
            placeholder="Tìm theo nhãn…"
            onChange={setLabel}
          />
        ),
        code: (
          <ColumnFilterButton
            label="mã"
            value={code}
            placeholder="Tìm theo mã…"
            onChange={setCode}
          />
        ),
        active: (
          <HeaderOptionFilter
            label="trạng thái"
            value={active}
            options={ACTIVE_OPTIONS}
            onChange={setActive}
            searchPlaceholder="Tìm trạng thái…"
            emptyLabel="Không có trạng thái"
          />
        ),
      })}
      rowKey={(v) => v.valueId}
      pageSize={10}
      emptyState={filtering ? "Không có giá trị nào khớp bộ lọc." : "Chưa có giá trị nào."}
    />
  );
}
