"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { STORAGE_KEYS } from "@/constants";

import { useColumnVisibility } from "@/hooks/use-column-visibility";

import { filterStandardPrices, matchesStandardPriceColumns } from "../selectors";

import type { StandardPrice } from "../schemas";

/** Khoá URL: ô tìm chính + lọc header cột SKU / Sản phẩm (state-persistence — F5 / gửi link giữ nguyên). */
const PARSERS = {
  spQ: parseAsString.withDefault(""),
  spSku: parseAsString.withDefault(""),
  spProduct: parseAsString.withDefault(""),
  spVariant: parseAsString.withDefault(""),
  spPriceFrom: parseAsString.withDefault(""),
  spPriceTo: parseAsString.withDefault(""),
};

export const STANDARD_PRICE_COLUMN_KEYS = [
  "sku",
  "product",
  "variant",
  "tiers",
  "note",
  "actions",
] as const;
export type StandardPriceColumn = (typeof STANDARD_PRICE_COLUMN_KEYS)[number];
const LOCKED: readonly StandardPriceColumn[] = ["sku", "actions"];

/**
 * Bộ lọc + ẩn hiện cột của danh sách giá chuẩn. BE `GET /catalog/standard-prices` trả cả mảng (không phân trang, không
 * tham số tìm) nên mọi lọc chạy ở FE trên toàn bộ danh sách — không phải chỉ một trang.
 */
export function useStandardPriceFilters() {
  const [values, setValues] = useQueryStates(PARSERS);
  const columns = useColumnVisibility(
    STORAGE_KEYS.adminStandardPricesColumns,
    STANDARD_PRICE_COLUMN_KEYS,
    { locked: LOCKED },
  );
  const hasColumnFilters = Boolean(
    values.spSku.trim() ||
    values.spProduct.trim() ||
    values.spVariant.trim() ||
    values.spPriceFrom ||
    values.spPriceTo,
  );
  const hasFilters = Boolean(values.spQ.trim()) || hasColumnFilters;
  return {
    ...values,
    columns,
    hasColumnFilters,
    hasFilters,
    set: (next: Partial<Record<keyof typeof PARSERS, string>>) =>
      void setValues(
        Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value || null])),
      ),
    clear: () => void setValues(null),
    apply: (prices: readonly StandardPrice[]) =>
      filterStandardPrices(prices, values.spQ).filter((p) =>
        matchesStandardPriceColumns(p, {
          sku: values.spSku,
          product: values.spProduct,
          variant: values.spVariant,
          priceFrom: values.spPriceFrom,
          priceTo: values.spPriceTo,
        }),
      ),
  };
}

export type StandardPriceFilters = ReturnType<typeof useStandardPriceFilters>;
