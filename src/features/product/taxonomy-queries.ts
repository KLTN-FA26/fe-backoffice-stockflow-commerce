import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createListQuery } from "@/lib/api/query-factory";

import { expandablePaths, toClientPage, visibleTreeRows } from "./category-tree";
import { brandKeys, categoryKeys } from "./queries";
import { listAllCategoryNodes, listBrandPage } from "./taxonomy-api";

import type { Brand, BrandPage, CategoryNode } from "./taxonomy-schemas";
import type { BrandListParams } from "./taxonomy-api";

/*
 * Dùng chung gốc khoá `brands` / `categories` với dropdown form sản phẩm (`queries.ts`) để
 * invalidate `.all` làm mới cả hai. Khoá list của màn quản lý luôn khác `list({})` (có `page` /
 * `size` hoặc `view`) nên không đụng cache dạng khác của dropdown.
 */

export const useBrandPage = createListQuery<Brand, BrandListParams, BrandPage>(
  brandKeys,
  listBrandPage,
  QUERY_TIMES.master,
);

/** `Specs.contains(name) OR contains(code)` + `Specs.eq(active)` của BE, áp trên cây đã tải. */
function matchesFilters(row: CategoryNode, filters: { q?: string; active?: boolean }): boolean {
  const q = filters.q?.trim().toLowerCase();
  if (q && !row.name.toLowerCase().includes(q) && !row.code.toLowerCase().includes(q)) return false;
  return filters.active === undefined || row.active === filters.active;
}

/**
 * Bảng danh mục: tải ĐỦ danh mục MỘT lần (mọi trạng thái) rồi lọc + phân trang phía FE. BE phân
 * trang theo thứ tự chuỗi `path` nên cắt trang ở BE có thể tách con khỏi cha; danh mục là master
 * data ít bản ghi nên tải hết rồi sắp `inTreeOrder` là đúng. Gõ tìm / đổi lọc không gọi lại API.
 */
export function useCategoryTreePage(
  filters: { q?: string; active?: boolean },
  page: number,
  size: number,
  enabled: boolean,
  /** Path các danh mục đang mở (cây kiểu Drive); null = hiện phẳng (đang tìm / lọc). */
  expanded: ReadonlySet<string> | null,
) {
  const { q, active } = filters;
  const select = useCallback(
    (rows: CategoryNode[]) => {
      const matched = rows.filter((row) => matchesFilters(row, { q, active }));
      return {
        ...toClientPage(visibleTreeRows(matched, expanded), page, size),
        expandable: expandablePaths(matched),
      };
    },
    [q, active, page, size, expanded],
  );
  return useQuery({
    queryKey: categoryKeys.list({ view: "tree" }),
    queryFn: ({ signal }) => listAllCategoryNodes({ sort: "path,asc" }, signal),
    select,
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.master,
  });
}

const PARENT_OPTIONS = { active: true, sort: "path,asc" } as const;

/** Ô chọn danh mục cha: MỌI danh mục đang dùng (tải hết các trang), theo thứ tự cây. */
export function useCategoryParentOptions(enabled = true) {
  return useQuery({
    queryKey: categoryKeys.list({ view: "parent-options", ...PARENT_OPTIONS }),
    queryFn: ({ signal }) => listAllCategoryNodes(PARENT_OPTIONS, signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}
