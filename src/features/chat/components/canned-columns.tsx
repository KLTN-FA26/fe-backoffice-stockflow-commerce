"use client";

import { Pencil, Trash2 } from "lucide-react";

import { CHAT_CANNED_LABELS as L } from "@/constants";

import { textIncludes } from "@/lib/text-match";

import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { CannedResponse } from "../schemas";

const MONO = "font-[family-name:var(--font-mono)] text-xs";

const DATA_COLUMNS: ColumnDef<CannedResponse>[] = [
  {
    key: "title",
    header: L.columns.title,
    className: "min-w-48",
    cell: (item) => (
      <div className="flex min-w-0 flex-col">
        <span className="text-ink-primary font-medium">{item.title}</span>
        {item.shortcut && <span className={`text-ink-tertiary ${MONO}`}>/{item.shortcut}</span>}
      </div>
    ),
  },
  {
    key: "category",
    header: L.columns.category,
    cell: (item) => <span className="text-ink-secondary">{item.category ?? "—"}</span>,
  },
  {
    key: "scope",
    header: L.columns.scope,
    cell: (item) => <span className="text-ink-secondary">{item.shared ? L.shared : L.own}</span>,
  },
  {
    key: "body",
    header: L.columns.body,
    className: "min-w-72",
    cell: (item) => (
      <p className="text-ink-secondary line-clamp-2 text-[0.8125rem] whitespace-pre-line">
        {item.body}
      </p>
    ),
  },
];

/**
 * Cột của bảng câu trả lời mẫu + cột "Thao tác" (menu "⋯", backoffice-erp-ui A6). Mẫu dùng chung chỉ người giám sát sửa
 * / xoá được (BE `requireChangeableBy`) — với người khác mục vẫn hiện nhưng khoá kèm lý do. Quyền UI-only, Backend phải
 * re-check.
 */
export function cannedColumns({
  canUpdate,
  canDelete,
  canShare,
  onEdit,
  onDelete,
}: {
  canUpdate: boolean;
  canDelete: boolean;
  canShare: boolean;
  onEdit: (item: CannedResponse) => void;
  onDelete: (item: CannedResponse) => void;
}): ColumnDef<CannedResponse>[] {
  const actionsOf = (item: CannedResponse): RowAction[] => {
    const locked = item.shared && !canShare;
    const hint = locked ? L.sharedLocked : undefined;
    const actions: RowAction[] = [];
    if (canUpdate)
      actions.push({
        label: L.edit,
        icon: Pencil,
        disabled: locked,
        hint,
        onSelect: () => onEdit(item),
      });
    if (canDelete)
      actions.push({
        label: L.remove,
        icon: Trash2,
        danger: true,
        disabled: locked,
        hint,
        onSelect: () => onDelete(item),
      });
    return actions;
  };
  return [
    ...DATA_COLUMNS,
    rowActionsColumn<CannedResponse>((item) => ({
      label: `Thao tác — ${item.title}`,
      actions: actionsOf(item),
    })),
  ];
}

/** Lọc trên header cột ngoài Nhóm — BE không có tham số riêng, lọc FE trên toàn bộ danh sách BE trả về. */
export interface CannedColumnFilters {
  title: string;
  scope: string;
  body: string;
}

/** Dòng khớp lọc cột: tiêu đề / phím tắt chứa chữ, phạm vi (`shared` | `own`), nội dung chứa chữ. */
export function matchesCannedColumns(item: CannedResponse, f: CannedColumnFilters): boolean {
  return (
    (textIncludes(item.title, f.title) || textIncludes(item.shortcut ?? "", f.title)) &&
    (f.scope === "" || (f.scope === "shared") === item.shared) &&
    textIncludes(item.body, f.body)
  );
}

const SCOPE_OPTIONS = [
  { value: "shared", label: L.shared },
  { value: "own", label: L.own },
];

/**
 * Lọc trên header mọi cột dữ liệu (backoffice-erp-ui A5): Nhóm → tham số BE `category`; Tiêu đề, Phạm vi, Nội dung → lọc
 * FE. Cùng khoá URL với thanh cấu hình.
 */
export function cannedHeaderFilters(
  category: string,
  setCategory: (value: string) => void,
  columns: CannedColumnFilters,
  setColumn: (next: Partial<CannedColumnFilters>) => void,
): Partial<Record<string, ReactNode>> {
  return {
    title: (
      <ColumnFilterButton
        label={L.columns.title.toLowerCase()}
        value={columns.title}
        placeholder={L.titleFilter}
        onChange={(value) => setColumn({ title: value })}
      />
    ),
    category: (
      <ColumnFilterButton
        label={L.columns.category.toLowerCase()}
        value={category}
        placeholder={L.categoryFilter}
        onChange={setCategory}
      />
    ),
    scope: (
      <HeaderOptionFilter
        label={L.columns.scope.toLowerCase()}
        value={columns.scope || null}
        options={SCOPE_OPTIONS}
        onChange={(value) => setColumn({ scope: value ?? "" })}
        searchPlaceholder="Tìm…"
        emptyLabel="Không có lựa chọn"
      />
    ),
    body: (
      <ColumnFilterButton
        label={L.columns.body.toLowerCase()}
        value={columns.body}
        placeholder={L.bodyFilter}
        onChange={(value) => setColumn({ body: value })}
      />
    ),
  };
}
