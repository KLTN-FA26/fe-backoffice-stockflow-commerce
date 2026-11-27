"use client";

import { useMemo } from "react";
import { parseAsString, useQueryStates } from "nuqs";

import { toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";

import { ColumnFilterButton, HeaderDateRangeFilter } from "@/components/shared/ColumnHeaderFilter";

import type { ReactNode } from "react";

/** Lọc chữ trên một cột: dòng khớp khi một trong các chuỗi `get` chứa chữ gõ (bỏ dấu). */
interface TextFilterSpec<T> {
  kind: "text";
  column: string;
  /** Chữ thường, vd "thiết kế" → "Lọc thiết kế", "Tìm theo thiết kế…". */
  label: string;
  get: (row: T) => readonly (string | null | undefined)[];
}

/** Lọc khoảng ngày trên một cột (ngày theo giờ Asia/Ho_Chi_Minh). */
interface DateFilterSpec<T> {
  kind: "date";
  column: string;
  label: string;
  get: (row: T) => string | null | undefined;
}

export type ReviewFilterSpec<T> = TextFilterSpec<T> | DateFilterSpec<T>;

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const textKey = (prefix: string, column: string) => `${prefix}${cap(column)}`;
const fromKey = (prefix: string, column: string) => `${prefix}${cap(column)}From`;
const toKey = (prefix: string, column: string) => `${prefix}${cap(column)}To`;

/**
 * Lọc trên header cột của hai danh sách duyệt (backoffice-erp-ui A5): mỗi cột một khoá URL `<prefix><Cột>` (ngày:
 * `…From` / `…To`). BE hàng đợi / vòng duyệt chỉ nhận page / size nên lọc chỉ xét trang đang xem. `specs` phải là hằng
 * ở cấp module (khoá URL dựng một lần).
 */
export function useReviewHeaderFilters<T>(prefix: string, specs: readonly ReviewFilterSpec<T>[]) {
  const parsers = useMemo(
    () =>
      Object.fromEntries(
        specs.flatMap((spec) =>
          spec.kind === "text"
            ? [[textKey(prefix, spec.column), parseAsString.withDefault("")]]
            : [
                [fromKey(prefix, spec.column), parseAsString.withDefault("")],
                [toKey(prefix, spec.column), parseAsString.withDefault("")],
              ],
        ),
      ),
    [prefix, specs],
  );
  const [values, setValues] = useQueryStates(parsers);
  const read = (key: string) => values[key] ?? "";
  const set = (patch: Record<string, string>) =>
    void setValues(
      Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value || null])),
    );

  const headerFilters: Partial<Record<string, ReactNode>> = Object.fromEntries(
    specs.map((spec) => {
      if (spec.kind === "text") {
        const key = textKey(prefix, spec.column);
        return [
          spec.column,
          <ColumnFilterButton
            key={key}
            label={spec.label}
            value={read(key)}
            placeholder={`Tìm theo ${spec.label}…`}
            onChange={(value) => set({ [key]: value })}
          />,
        ];
      }
      const from = fromKey(prefix, spec.column);
      const to = toKey(prefix, spec.column);
      return [
        spec.column,
        <HeaderDateRangeFilter
          key={from}
          label={spec.label}
          from={read(from)}
          to={read(to)}
          onChange={(range) => set({ [from]: range.from, [to]: range.to })}
        />,
      ];
    }),
  );

  const matches = (row: T) =>
    specs.every((spec) => {
      if (spec.kind === "text") {
        const query = read(textKey(prefix, spec.column));
        return !query.trim() || spec.get(row).some((text) => textIncludes(text, query));
      }
      const from = read(fromKey(prefix, spec.column));
      const to = read(toKey(prefix, spec.column));
      if (!from && !to) return true;
      const value = spec.get(row);
      if (!value) return false;
      const day = toLocalIsoDate(value);
      return (!from || day >= from) && (!to || day <= to);
    });

  return {
    headerFilters,
    matches,
    active: Object.values(values).some((value) => Boolean(value?.trim())),
    clear: () => void setValues(Object.fromEntries(Object.keys(parsers).map((key) => [key, null]))),
  };
}
