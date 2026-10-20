import { cn } from "cn";

import { effectiveUnitPrice, isUnitPriceRequired } from "@/features/purchase-order";

import type { PoCreateFormLine } from "@/features/purchase-order";
import type { Totals } from "./types";

export function fieldClass(hasError = false): string {
  return cn(
    "h-8 w-full rounded-[var(--r-sm)] border bg-bg-surface px-2.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError ? "border-danger focus:border-danger" : "border-border-default focus:border-brand",
  );
}

export function createEmptyLine(): PoCreateFormLine {
  return {
    skuId: "",
    description: "",
    orderedQty: "1",
    unitPrice: "",
    taxRate: "",
    lineId: "",
    terms: null,
  };
}

type LineAmounts = Pick<
  PoCreateFormLine,
  "orderedQty" | "unitPrice" | "taxRate" | "terms" | "lineId" | "skuId" | "description"
>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** SL × đơn giá hiệu lực (giá gõ tay, hoặc giá danh mục khi trống), trước thuế (BE `PoLine#subtotal`). */
export function lineSubtotal(line: LineAmounts, poCurrency: string): number {
  const price = effectiveUnitPrice(line, poCurrency) ?? 0;
  return round2((Number(line.orderedQty) || 0) * price);
}

/** Thuế của dòng (BE `PoLine#tax`: tạm tính × thuế suất / 100, làm tròn 2 chữ số). */
export function lineTax(line: LineAmounts, poCurrency: string): number {
  return round2((lineSubtotal(line, poCurrency) * (Number(line.taxRate) || 0)) / 100);
}

/** Thành tiền gồm thuế (BE `PoLine#total`). */
export function lineTotal(line: LineAmounts, poCurrency: string): number {
  return lineSubtotal(line, poCurrency) + lineTax(line, poCurrency);
}

/** BE `PurchaseOrder`: subtotal, taxTotal, totalAmount = subtotal + taxTotal. */
export function calculateTotals(lines: readonly PoCreateFormLine[], poCurrency: string): Totals {
  const subtotal = lines.reduce((acc, line) => acc + lineSubtotal(line, poCurrency), 0);
  const taxTotal = lines.reduce((acc, line) => acc + lineTax(line, poCurrency), 0);
  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}

/** Dòng để trống đơn giá và dùng giá danh mục (cùng tiền tệ PO) — BE #118 lấy giá danh mục. */
export function usesCatalogPrice(line: PoCreateFormLine, poCurrency: string): boolean {
  return line.unitPrice.trim() === "" && !isUnitPriceRequired(line, poCurrency);
}

/**
 * Màn sửa nháp: kho đang lưu trên PO không còn trong danh sách kho ACTIVE (ngừng hoạt động / ngoài
 * phạm vi) — trả kho đó để ô kho vẫn hiện tên và báo phải đổi; còn trong danh sách thì null.
 */
export function warehouseOutsideList<T extends { warehouseId: string; name: string }>(
  warehouses: readonly { warehouseId: string }[],
  current: T | undefined,
): T | null {
  if (!current) return null;
  return warehouses.some((wh) => wh.warehouseId === current.warehouseId) ? null : current;
}
