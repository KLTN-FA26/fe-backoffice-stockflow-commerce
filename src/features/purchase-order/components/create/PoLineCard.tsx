"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";

import type { Currency } from "@/features/purchase-order";
import type { Sku } from "@/features/product";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";
import { PoLineFields } from "./PoLineFields";
import { SkuCombobox } from "./SkuCombobox";
import type { PoLineDraft } from "./types";

export function PoLineCard({
  line,
  index,
  activeSkus,
  showErrors,
  hasDuplicate,
  currency,
  onSkuChange,
  onRemove,
  onUpdate,
}: {
  line: PoLineDraft;
  index: number;
  activeSkus: Sku[];
  showErrors: boolean;
  hasDuplicate: boolean;
  currency: Currency;
  onSkuChange: (lineId: string, skuId: string) => void;
  onRemove: (lineId: string) => void;
  onUpdate: (lineId: string, patch: Partial<PoLineDraft>) => void;
}) {
  const selectedSku = activeSkus.find((s) => s.skuId === line.skuId);
  return (
    <div
      className={cn(
        "bg-bg-subtle rounded-[var(--r-sm)] border p-3",
        hasDuplicate ? "border-danger/30" : "border-border-default",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-brand text-ink-inverse flex size-6 items-center justify-center rounded-full text-xs font-medium">
            {index + 1}
          </span>
          <div>
            <div className="text-ink-primary text-[0.8125rem] font-medium">
              Dòng hàng {index + 1}
            </div>
            <div className="text-ink-tertiary text-xs">
              {selectedSku?.variantLabel ?? "Chưa chọn SKU"}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onRemove(line.id)}
          className="border-danger/30 text-danger hover:bg-danger/10 flex size-8 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
          aria-label="Xóa dòng hàng"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="grid gap-2.5">
        <div className="grid gap-2.5 sm:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
              SKU <span className="text-danger">*</span>
            </label>
            <SkuCombobox
              value={line.skuId}
              onChange={(v) => onSkuChange(line.id, v)}
              skus={activeSkus}
              hasError={showErrors && (!line.skuId || hasDuplicate)}
              ariaLabel={`SKU dòng ${index + 1}`}
            />
            {hasDuplicate && <FieldError>SKU bị trùng trong PO.</FieldError>}
          </div>
          <div className="min-w-0">
            <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
              Mô tả dòng
            </label>
            <Textarea
              value={line.description}
              onChange={(e) => onUpdate(line.id, { description: e.target.value })}
              placeholder="Mô tả (tuỳ chọn)"
              rows={2}
              className={fieldClass().replace("h-8 ", "") + " min-h-[56px] resize-y py-2"}
            />
          </div>
        </div>
        <PoLineFields line={line} currency={currency} showErrors={showErrors} onUpdate={onUpdate} />
      </div>
    </div>
  );
}
