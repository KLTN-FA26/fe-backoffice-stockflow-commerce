"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";
import { textIncludes } from "@/lib/text-match";

import { ListFilterColumn, ListToolbar } from "@/components/shared/ListToolbar";

import { REVIEW_TOOLBAR_COPY as T } from "./copy";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { ListOption } from "@/components/shared/ListToolbar";

type WaitBucket = "lt1d" | "1to3d" | "gt3d";

const DAY_MS = 86_400_000;
const WAIT_OPTIONS: readonly ListOption<WaitBucket>[] = [
  { value: "lt1d", label: T.waitLt1d },
  { value: "1to3d", label: T.wait1to3d },
  { value: "gt3d", label: T.waitGt3d },
];

/** Nhóm thời gian chờ duyệt — tính từ lúc gửi duyệt tới `now`. */
function waitBucket(since: string | null | undefined, now: Date): WaitBucket | null {
  if (!since) return null;
  const days = (now.getTime() - new Date(since).getTime()) / DAY_MS;
  return days < 1 ? "lt1d" : days <= 3 ? "1to3d" : "gt3d";
}

/** Cách đọc một dòng cho ô tìm và bảng "Bộ lọc". */
export interface ReviewRowAccess<T> {
  searchText: (row: T) => readonly (string | null | undefined)[];
  customer: (row: T) => string | null | undefined;
  since: (row: T) => string | null | undefined;
}

/**
 * Ô tìm + bộ lọc (khách hàng, thời gian chờ) của hai danh sách duyệt — trên URL, khoá theo `prefix`. BE hàng đợi / vòng
 * duyệt chỉ nhận page / size nên mọi lọc ở đây chỉ xét trang đang xem (chú thích bảng nói rõ).
 */
export function useReviewToolbarFilters<T>(prefix: string, access: ReviewRowAccess<T>, now: Date) {
  const [q, setQ] = useQueryState(`${prefix}Q`, parseAsString.withDefault(""));
  const [customers, setCustomers] = useQueryState(
    `${prefix}Customers`,
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [waits, setWaits] = useQueryState(
    `${prefix}Wait`,
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const toggle = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return {
    q,
    customers,
    waits,
    setQ: (value: string) => void setQ(value || null),
    toggleCustomer: (value: string) => {
      const next = toggle(customers, value);
      void setCustomers(next.length ? next : null);
    },
    toggleWait: (value: string) => {
      const next = toggle(waits, value);
      void setWaits(next.length ? next : null);
    },
    clearCustomers: () => void setCustomers(null),
    clearWaits: () => void setWaits(null),
    clearPanel: () => {
      void setCustomers(null);
      void setWaits(null);
    },
    clear: () => {
      void setQ(null);
      void setCustomers(null);
      void setWaits(null);
    },
    active: Boolean(q.trim() || customers.length || waits.length),
    matches: (row: T) =>
      (!q.trim() || access.searchText(row).some((text) => textIncludes(text, q))) &&
      (customers.length === 0 || customers.includes(access.customer(row) ?? "")) &&
      (waits.length === 0 || waits.includes(waitBucket(access.since(row), now) ?? "")),
  };
}

export type ReviewToolbarFilters<T> = ReturnType<typeof useReviewToolbarFilters<T>>;

function summaryValue(selected: readonly string[], labelOf: (v: string) => string) {
  return selected.length === 0 ? T.all : selected.map(labelOf).join(", ");
}

/** Toolbar kiểu Vercel (backoffice-erp-ui A2–A4) của hàng đợi duyệt và danh sách vòng duyệt. */
export function ReviewListToolbar<T, C extends string>({
  filters,
  rows,
  customerOf,
  searchPlaceholder,
  columns,
  columnLabels,
  allColumns,
}: {
  filters: ReviewToolbarFilters<T>;
  /** Dòng của trang đang xem — nguồn danh sách khách trong "Bộ lọc". */
  rows: readonly T[];
  customerOf: (row: T) => string | null | undefined;
  searchPlaceholder: string;
  columns: ColumnVisibility<C>;
  columnLabels: Record<C, string>;
  allColumns: readonly C[];
}) {
  const customerOptions = [
    ...new Set([...rows.map((row) => customerOf(row) ?? ""), ...filters.customers]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({ value: name, label: name }));
  const waitLabel = (v: string) => WAIT_OPTIONS.find((o) => o.value === v)?.label ?? v;

  return (
    <ListToolbar
      controlsIn="summary"
      search={filters.q}
      onSearchChange={filters.setQ}
      searchPlaceholder={searchPlaceholder}
      {...columnToolbarProps(columns, columnLabels, allColumns)}
      filterPanel={
        <>
          <ListFilterColumn
            title={T.customer}
            searchPlaceholder={T.customerSearch}
            emptyText={T.customerEmpty}
            options={customerOptions}
            isChecked={(value) => filters.customers.includes(value)}
            onSelect={filters.toggleCustomer}
          />
          <ListFilterColumn
            title={T.wait}
            searchPlaceholder={T.waitSearch}
            emptyText={T.waitEmpty}
            options={WAIT_OPTIONS}
            isChecked={(value) => filters.waits.includes(value)}
            onSelect={filters.toggleWait}
          />
        </>
      }
      hasPanelFilter={filters.customers.length > 0 || filters.waits.length > 0}
      onClearPanelFilters={filters.clearPanel}
      summaryItems={[
        {
          label: T.customer,
          value: summaryValue(filters.customers, (v) => v),
          active: filters.customers.length > 0,
          onClear: filters.clearCustomers,
        },
        {
          label: T.wait,
          value: summaryValue(filters.waits, waitLabel),
          active: filters.waits.length > 0,
          onClear: filters.clearWaits,
        },
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={!filters.active && !columns.hasColumnConfig}
    />
  );
}
