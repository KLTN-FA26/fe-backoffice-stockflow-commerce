"use client";

import { Plus } from "lucide-react";
import { cn } from "cn";

import { formatMoney } from "@/features/purchase-order";

import type { Currency } from "@/features/purchase-order";
import type { Sku } from "@/features/product";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { SummaryItem } from "./CreateFormPrimitives";
import { calculateTotals } from "./helpers";
import { PoLineCard } from "./PoLineCard";
import type { FormState, PoLineDraft } from "./types";

export function LinesStep({
  form,
  activeSkus,
  showErrors,
  currency,
  onAddLine,
  onRemoveLine,
  onSkuChange,
  updateLine,
}: {
  form: FormState;
  activeSkus: Sku[];
  showErrors: boolean;
  currency: Currency;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onSkuChange: (lineId: string, skuId: string) => void;
  updateLine: (lineId: string, patch: Partial<PoLineDraft>) => void;
}) {
  const dupSkuIds = new Set<string>();
  const seen = new Set<string>();
  for (const l of form.lines) {
    if (!l.skuId) continue;
    if (seen.has(l.skuId)) dupSkuIds.add(l.skuId);
    seen.add(l.skuId);
  }
  const totals = calculateTotals(form.lines);

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
            Dòng hàng
          </h2>
          <p className="text-ink-secondary mt-1 text-[0.8125rem]">
            Thêm SKU Active, số lượng đặt và đơn giá — tổng = số lượng × đơn giá.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddLine}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
        >
          <Plus className="size-3.5" />
          Thêm dòng hàng
        </Button>
      </div>

      {form.lines.length === 0 ? (
        <div
          className={cn(
            "rounded-[var(--r-sm)] border px-4 py-8 text-center text-[0.8125rem]",
            showErrors
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-border-default bg-bg-subtle text-ink-tertiary",
          )}
        >
          Chưa có dòng hàng. Cần ít nhất một dòng trước khi gửi duyệt.
        </div>
      ) : (
        <div className="max-h-[min(58vh,520px)] space-y-3 overflow-y-auto pr-1">
          {form.lines.map((line, index) => (
            <PoLineCard
              key={line.id}
              line={line}
              index={index}
              activeSkus={activeSkus}
              showErrors={showErrors}
              hasDuplicate={line.skuId !== "" && dupSkuIds.has(line.skuId)}
              currency={currency}
              onSkuChange={onSkuChange}
              onRemove={onRemoveLine}
              onUpdate={updateLine}
            />
          ))}
        </div>
      )}

      <div className="bg-bg-surface border-border-default sticky bottom-0 mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
        <SummaryItem label="Số dòng" value={String(form.lines.length)} mono />
        <SummaryItem label="Tạm tính" value={formatMoney(totals.subtotal, currency)} mono />
        <SummaryItem label="Tổng dòng hàng" value={formatMoney(totals.grandTotal, currency)} mono />
      </div>
    </Card>
  );
}
