"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { STORAGE_KEYS, TAXONOMY_CATEGORY_COLUMNS, UI_LABELS } from "@/constants";
import { viewColumn } from "@/components/shared/column-helpers";
import { ToolbarIconButton } from "@/components/shared/ListToolbar";

import { useCategoryTreePage } from "../../taxonomy-queries";
import { CATEGORY_COLUMN_LABELS, buildCategoryColumns } from "./taxonomy-columns";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { TaxonomyListBody } from "./TaxonomyListBody";
import { TaxonomyToolbar } from "./TaxonomyToolbar";
import { useTaxonomyListState } from "./useTaxonomyListState";

import type { CategoryRow } from "./taxonomy-columns";

const L = UI_LABELS.taxonomy;
const ALL_COLUMNS = Object.values(TAXONOMY_CATEGORY_COLUMNS);

/**
 * Tab Danh mục — cây thư mục kiểu Drive (mũi tên mở / thu gọn danh mục con) theo thứ tự cây
 * (`useCategoryTreePage`: tải đủ rồi phân trang phía FE) để con luôn nằm ngay dưới cha, kể cả khi
 * mã có '-' / trùng tiền tố hay cha ở trang khác.
 * Bấm dòng để sửa (hoặc xem khi thiếu quyền sửa).
 */
export function CategoryList() {
  const s = useTaxonomyListState(STORAGE_KEYS.adminTaxonomyCategoriesConfig, ALL_COLUMNS);
  // Path đang mở — mặc định chỉ thấy danh mục gốc, như duyệt thư mục trên Drive (UI state cục bộ)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const asTree = !s.filtered;
  const query = useCategoryTreePage(
    { q: s.params.q, active: s.params.active },
    s.params.page,
    s.params.size,
    s.canRead,
    // Đang tìm / lọc thì tổ tiên có thể không có trong kết quả → hiện phẳng
    asTree ? expanded : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.items.find((c) => c.categoryId === selectedId);
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const columns = [
    ...buildCategoryColumns(asTree ? { expanded, onToggle: toggle } : null).filter((c) =>
      s.config.visibleColumns.includes(c.key),
    ),
    viewColumn<CategoryRow>((row) => ({
      label: `${L.viewRow} ${row.name}`,
      onOpen: () => setSelectedId(row.categoryId),
    })),
  ];
  const expandable = query.data?.expandable ?? [];

  return (
    <>
      <TaxonomyToolbar
        s={s}
        searchPlaceholder={L.categorySearchPlaceholder}
        columnLabels={CATEGORY_COLUMN_LABELS}
        lockedColumn={TAXONOMY_CATEGORY_COLUMNS.CODE}
        tools={
          // Mở / thu gọn cây: icon cạnh các công cụ khác, chỉ khi đang xem dạng cây
          asTree &&
          expandable.length > 0 && (
            <>
              <ToolbarIconButton
                label={L.expandAll}
                icon={<ChevronsUpDown className="size-4" />}
                onClick={() => setExpanded(new Set(expandable))}
              />
              <ToolbarIconButton
                label={L.collapseAll}
                icon={<ChevronsDownUp className="size-4" />}
                onClick={() => setExpanded(new Set())}
              />
            </>
          )
        }
      />
      {query.data?.truncated && <p className="text-warning mb-2 text-xs">{L.listTruncated}</p>}
      <TaxonomyListBody
        s={s}
        query={query}
        columns={columns}
        rowKey={(row) => row.categoryId}
        onRowClick={(row) => setSelectedId(row.categoryId)}
        noun={L.categoryNoun}
        emptyTitle={L.categoryEmptyTitle}
        emptyDescription={L.categoryEmptyDescription}
      />
      <CategoryFormDialog
        category={selected}
        open={selected !== undefined}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </>
  );
}
