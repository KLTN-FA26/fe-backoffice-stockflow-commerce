"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { CHAT_CANNED_LABELS as L } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { CannedColumnFilters } from "./canned-columns";

/**
 * Bộ lọc trang câu trả lời mẫu, tất cả trên URL (state-persistence): `q` + `category` là tham số BE (gõ → 300 ms → gọi
 * BE); `cnTitle` / `cnScope` / `cnBody` lọc FE trên toàn bộ danh sách BE trả về.
 */
const PARSERS = {
  q: parseAsString.withDefault(""),
  category: parseAsString.withDefault(""),
  cnTitle: parseAsString.withDefault(""),
  cnScope: parseAsString.withDefault(""),
  cnBody: parseAsString.withDefault(""),
};

export function useCannedFilters() {
  const [f, setFilters] = useQueryStates(PARSERS);
  const columns: CannedColumnFilters = { title: f.cnTitle, scope: f.cnScope, body: f.cnBody };
  const columnFiltered = Boolean(f.cnTitle.trim() || f.cnScope || f.cnBody.trim());
  const columnSummary =
    [
      f.cnTitle.trim() && `${L.columns.title} “${f.cnTitle.trim()}”`,
      f.category.trim() && `${L.columns.category} “${f.category}”`,
      f.cnScope && `${L.columns.scope} ${f.cnScope === "shared" ? L.shared : L.own}`,
      f.cnBody.trim() && `${L.columns.body} “${f.cnBody.trim()}”`,
    ]
      .filter(Boolean)
      .join(", ") || L.unused;
  return {
    q: f.q,
    category: f.category,
    serverQ: useDebouncedValue(f.q, 300).trim(),
    serverCategory: useDebouncedValue(f.category, 300).trim(),
    columns,
    columnSummary,
    columnSearchActive: !!f.category.trim() || columnFiltered,
    filtered: !!f.q.trim() || !!f.category.trim() || columnFiltered,
    setQ: (value: string) => void setFilters({ q: value || null }),
    setCategory: (value: string) => void setFilters({ category: value || null }),
    setColumn: (next: Partial<CannedColumnFilters>) =>
      void setFilters({
        ...(next.title !== undefined && { cnTitle: next.title || null }),
        ...(next.scope !== undefined && { cnScope: next.scope || null }),
        ...(next.body !== undefined && { cnBody: next.body || null }),
      }),
    clearColumnSearch: () =>
      void setFilters({ category: null, cnTitle: null, cnScope: null, cnBody: null }),
    clear: () => void setFilters(null),
  };
}
