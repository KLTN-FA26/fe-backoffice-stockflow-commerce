import { cn } from "cn";

import type { PoCreateFormLine } from "@/features/purchase-order";
import type { Totals } from "./types";

export function fieldClass(hasError = false): string {
  return cn(
    "h-8 w-full rounded-[var(--r-sm)] border bg-bg-surface px-2.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError ? "border-danger focus:border-danger" : "border-border-default focus:border-brand",
  );
}

export function createEmptyLine(): PoCreateFormLine {
  return { skuId: "", description: "", orderedQty: "1", unitPrice: "", taxRate: "" };
}

type LineAmounts = Pick<PoCreateFormLine, "orderedQty" | "unitPrice" | "taxRate">;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** SL × đơn giá, trước thuế (BE `PoLine#subtotal`, 2 chữ số). */
export function lineSubtotal(line: Pick<PoCreateFormLine, "orderedQty" | "unitPrice">): number {
  return round2((Number(line.orderedQty) || 0) * (Number(line.unitPrice) || 0));
}

/** Thuế của dòng (BE `PoLine#tax`: tạm tính × thuế suất / 100, làm tròn 2 chữ số). */
export function lineTax(line: LineAmounts): number {
  return round2((lineSubtotal(line) * (Number(line.taxRate) || 0)) / 100);
}

/** Thành tiền gồm thuế (BE `PoLine#total`). */
export function lineTotal(line: LineAmounts): number {
  return lineSubtotal(line) + lineTax(line);
}

/** BE `PurchaseOrder`: subtotal, taxTotal, totalAmount = subtotal + taxTotal. */
export function calculateTotals(lines: readonly PoCreateFormLine[]): Totals {
  const subtotal = lines.reduce((acc, line) => acc + lineSubtotal(line), 0);
  const taxTotal = lines.reduce((acc, line) => acc + lineTax(line), 0);
  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}

/** Mã SKU nhập tay → dạng BE lưu (`common.domain.Sku`: trim + upper-case). */
export function normalizeSkuCode(raw: string): string {
  return raw.trim().toUpperCase();
}
