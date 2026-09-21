import { cn } from "cn";

import {
  INITIAL_FORM,
  type FormState,
  type PoLineDraft,
  type Totals,
  type ValidationIssue,
} from "./types";

export function parsePositiveNumber(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function parseNonNegativeRate(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function fieldClass(hasError = false): string {
  return cn(
    "h-8 w-full rounded-[var(--r-sm)] border bg-bg-surface px-2.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError ? "border-danger focus:border-danger" : "border-border-default focus:border-accent",
  );
}

export function createEmptyLine(): PoLineDraft {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skuId: "",
    orderedQty: "1",
    unitPrice: "",
    taxRate: "0.08",
    discountRate: "0",
    uom: "",
    description: "",
  };
}

export function lineSubtotal(line: PoLineDraft): number {
  const qty = Number(line.orderedQty) || 0;
  const price = Number(line.unitPrice) || 0;
  return qty * price;
}

export function lineTax(line: PoLineDraft): number {
  return lineSubtotal(line) * (Number(line.taxRate) || 0);
}

export function lineDiscount(line: PoLineDraft): number {
  return lineSubtotal(line) * (Number(line.discountRate) || 0);
}

export function lineTotal(line: PoLineDraft): number {
  return lineSubtotal(line) - lineDiscount(line) + lineTax(line);
}

export function calculateTotals(lines: PoLineDraft[]): Totals {
  return lines.reduce<Totals>(
    (acc, line) => {
      acc.subtotal += lineSubtotal(line);
      acc.taxTotal += lineTax(line);
      acc.discountTotal += lineDiscount(line);
      acc.grandTotal += lineTotal(line);
      return acc;
    },
    { subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0 },
  );
}

export function validateForm(form: FormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!form.supplierId) issues.push({ step: "info", message: "Nhà cung cấp là bắt buộc." });
  if (form.lines.length === 0) {
    issues.push({ step: "lines", message: "Cần ít nhất một dòng hàng." });
  }
  const seenSkuIds = new Set<string>();
  for (const line of form.lines) {
    if (!line.skuId) {
      issues.push({ step: "lines", message: "Mỗi dòng hàng cần chọn SKU." });
      continue;
    }
    if (seenSkuIds.has(line.skuId)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId} bị trùng trong PO.` });
    }
    seenSkuIds.add(line.skuId);
    if (!parsePositiveNumber(line.orderedQty)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: SL đặt phải lớn hơn 0.` });
    }
    if (!parsePositiveNumber(line.unitPrice)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Đơn giá phải lớn hơn 0.` });
    }
    if (!parseNonNegativeRate(line.taxRate)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Thuế không được âm.` });
    }
    if (!parseNonNegativeRate(line.discountRate)) {
      issues.push({ step: "lines", message: `SKU ${line.skuId}: Chiết khấu không được âm.` });
    }
  }
  return issues;
}

export function isExpectedDatePast(expectedDate: string): boolean {
  return expectedDate !== "" && expectedDate < INITIAL_FORM.orderDate;
}
