"use client";

import { PUT_BACK_LABELS } from "@/constants";
import { ListToolbar } from "@/components/shared/ListToolbar";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { PutBackListState } from "./usePutBackListState";

const P = PUT_BACK_LABELS;

/**
 * Toolbar hàng đợi trả về kệ (style Vercel, `ListToolbar`): ô tìm (lọc client), thanh "Cấu hình" có badge Tìm
 * kiếm chính. Kho là kho của tab theo kho — không có ô chọn kho.
 */
export function PutBackToolbar({ s }: { s: PutBackListState }) {
  const summaryItems: ListSummaryItem[] = [
    {
      label: P.searchSummary,
      value: s.q ? `“${s.q}”` : P.searchUnused,
      active: s.q !== "",
      onClear: () => s.setQ(""),
    },
  ];
  return (
    <ListToolbar
      search={s.q}
      onSearchChange={s.setQ}
      searchPlaceholder={P.searchPlaceholder}
      summaryItems={summaryItems}
      onResetAll={s.clearFilters}
      resetDisabled={!s.hasFilters}
    />
  );
}
