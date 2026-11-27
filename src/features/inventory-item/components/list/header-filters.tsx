"use client";

import { textIncludes } from "@/lib/text-match";

import { INVENTORY_ITEM_COLUMNS as C } from "@/constants";
import { ColumnFilterButton } from "@/components/shared/ColumnHeaderFilter";

import { COLUMN_FILTER_COPY } from "./constants";

import type { ReactNode } from "react";
import type { InventoryItemSummary } from "@/features/inventory-item/types";

export interface ItemColumnSearch {
  sku: string;
  barcode: string;
}

/** Dòng khớp ô lọc cột SKU / Mã vạch (rỗng = không lọc cột đó). */
export function matchesItemColumnSearch(
  row: InventoryItemSummary,
  filters: ItemColumnSearch,
): boolean {
  return textIncludes(row.sku, filters.sku) && textIncludes(row.barcode, filters.barcode);
}

/**
 * Nút lọc trên header bảng hồ sơ hàng tồn — mỗi cột một khoá URL riêng (`itemSku` / `itemBarcode`),
 * tách khỏi ô tìm chính (`q`). BE `GET /inventory/items` chỉ có một `q` (khớp SKU HOẶC mã vạch) nên
 * trang gửi chữ đó để thu hẹp rồi lọc đúng cột bằng `matchesItemColumnSearch`. Đơn vị tính không có
 * lọc cột: BE không tìm theo ĐVT, lọc FE chỉ thấy trang đang tải — gây hiểu sai.
 */
export function itemHeaderFilters({
  sku,
  onSkuChange,
  barcode,
  onBarcodeChange,
}: ItemColumnSearch & {
  onSkuChange: (value: string) => void;
  onBarcodeChange: (value: string) => void;
}): Partial<Record<string, ReactNode>> {
  return {
    [C.SKU]: (
      <ColumnFilterButton
        label={COLUMN_FILTER_COPY.skuLabel}
        value={sku}
        placeholder={COLUMN_FILTER_COPY.skuPlaceholder}
        onChange={onSkuChange}
      />
    ),
    [C.BARCODE]: (
      <ColumnFilterButton
        label={COLUMN_FILTER_COPY.barcodeLabel}
        value={barcode}
        placeholder={COLUMN_FILTER_COPY.barcodePlaceholder}
        onChange={onBarcodeChange}
      />
    ),
  };
}
