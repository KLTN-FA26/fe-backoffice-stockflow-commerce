"use client";

import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";

import { TAXONOMY_BRAND_COLUMNS, TAXONOMY_CATEGORY_COLUMNS, UI_LABELS } from "@/constants";

import { ActiveBadge } from "./form-parts";
import { TaxonomyThumb } from "./TaxonomyThumb";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CategoryTreeRow } from "../../category-tree";
import type { Brand, CategoryNode } from "../../taxonomy-schemas";

const B = TAXONOMY_BRAND_COLUMNS;
const C = TAXONOMY_CATEGORY_COLUMNS;
const L = UI_LABELS.taxonomy;
const F = L.field;
const CELL = "text-[0.8125rem]";
const MONO = `font-[family-name:var(--font-mono)] ${CELL}`;
const NUMBER = `text-ink-secondary tabular-nums ${MONO}`;

export const BRAND_COLUMN_LABELS: Record<string, string> = {
  [B.CODE]: F.code,
  [B.LOGO]: F.logo,
  [B.NAME]: F.name,
  [B.SLUG]: F.slug,
  [B.ACTIVE]: F.active,
};

export const CATEGORY_COLUMN_LABELS: Record<string, string> = {
  [C.CODE]: F.code,
  [C.NAME]: F.name,
  [C.LEVEL]: F.level,
  [C.SORT_ORDER]: F.sortOrder,
  [C.ACTIVE]: F.active,
};

const codeCell = (code: string) => (
  <span className={`text-ink-primary font-medium ${MONO}`}>{code}</span>
);

/** Cột bảng thương hiệu — đúng field `BrandResponse`. */
export function buildBrandColumns(): ColumnDef<Brand>[] {
  return [
    { key: B.CODE, header: F.code, cell: (row) => codeCell(row.code) },
    {
      key: B.LOGO,
      header: F.logo,
      cell: (row) => <TaxonomyThumb url={row.logoUrl} name={row.name} />,
    },
    {
      key: B.NAME,
      header: F.name,
      cell: (row) => <span className={`text-ink-primary ${CELL}`}>{row.name}</span>,
    },
    {
      key: B.SLUG,
      header: F.slug,
      cell: (row) => <span className={`text-ink-secondary ${MONO}`}>{row.slug}</span>,
    },
    { key: B.ACTIVE, header: F.active, cell: (row) => <ActiveBadge active={row.active} /> },
  ];
}

export type CategoryRow = CategoryTreeRow<CategoryNode>;

/** Cây kiểu Drive: path đang mở + bấm mũi tên để mở / thu gọn. null = hiện phẳng (đang tìm / lọc). */
export interface CategoryTreeControls {
  expanded: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

function CategoryNameCell({ row, tree }: { row: CategoryRow; tree: CategoryTreeControls | null }) {
  const open = tree?.expanded.has(row.path) ?? false;
  const hasChildren = row.childCount > 0;
  const FolderIcon = hasChildren && open ? FolderOpen : Folder;
  return (
    <span
      className={`text-ink-primary inline-flex items-center gap-1.5 ${CELL}`}
      // Thụt lề theo cấp — giá trị tính từ dữ liệu nên không dùng được class tĩnh
      style={{ paddingInlineStart: tree ? `${row.depth * 1.5}rem` : undefined }}
    >
      {tree &&
        (hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? L.collapseRow : L.expandRow} ${row.name}`}
            // Không mở dialog sửa khi chỉ bấm mũi tên
            onClick={(e) => {
              e.stopPropagation();
              tree.onToggle(row.path);
            }}
            className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary focus-visible:ring-border-strong grid size-5 place-items-center rounded-[var(--r-sm)] focus-visible:ring-2 focus-visible:outline-none"
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span aria-hidden="true" className="size-5" />
        ))}
      <FolderIcon
        aria-hidden="true"
        className={`size-4 shrink-0 ${hasChildren ? "text-accent" : "text-ink-tertiary"}`}
      />
      {row.name}
      {hasChildren && (
        <span className="text-ink-tertiary text-xs tabular-nums">({row.childCount})</span>
      )}
    </span>
  );
}

/**
 * Cột bảng danh mục — dòng đã theo thứ tự cây; cột tên là cây thư mục (mũi tên mở / thu gọn, icon
 * thư mục, số con) như khi duyệt thư mục trên Drive — vị trí trong cây đã cho biết danh mục cha.
 */
export function buildCategoryColumns(tree: CategoryTreeControls | null): ColumnDef<CategoryRow>[] {
  return [
    { key: C.CODE, header: F.code, cell: (row) => codeCell(row.code) },
    {
      key: C.NAME,
      header: F.name,
      cell: (row) => <CategoryNameCell row={row} tree={tree} />,
    },
    {
      key: C.LEVEL,
      header: F.level,
      align: "right",
      cell: (row) => <span className={NUMBER}>{row.depth + 1}</span>,
    },
    {
      key: C.SORT_ORDER,
      header: F.sortOrder,
      align: "right",
      cell: (row) => <span className={NUMBER}>{row.sortOrder}</span>,
    },
    { key: C.ACTIVE, header: F.active, cell: (row) => <ActiveBadge active={row.active} /> },
  ];
}
