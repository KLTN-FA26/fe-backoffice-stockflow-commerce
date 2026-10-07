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
  return { skuId: "", description: "", orderedQty: "1", unitPrice: "" };
}

export function lineTotal(line: Pick<PoCreateFormLine, "orderedQty" | "unitPrice">): number {
  return (Number(line.orderedQty) || 0) * (Number(line.unitPrice) || 0);
}

/** BE `totalAmount` = Σ SL đặt × đơn giá (BE chưa có thuế / chiết khấu). */
export function calculateTotals(lines: readonly PoCreateFormLine[]): Totals {
  return { grandTotal: lines.reduce((acc, line) => acc + lineTotal(line), 0) };
}

/** Mã SKU nhập tay → dạng BE lưu (`common.domain.Sku`: trim + upper-case). */
export function normalizeSkuCode(raw: string): string {
  return raw.trim().toUpperCase();
}
