"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";
import { LineTermsHint } from "./LineTermsHint";
import { PoLineFields } from "./PoLineFields";
import { SkuCatalogCombobox } from "./SkuCatalogCombobox";

import type { CreatePoWizard } from "./useCreateForm";

const C = UI_LABELS.purchaseOrder.catalog;

/** Một dòng hàng — mọi ô `register` vào react-hook-form, lỗi (client + server) hiện inline. */
export function PoLineCard({
  w,
  index,
  onRemove,
}: {
  w: CreatePoWizard;
  index: number;
  onRemove: () => void;
}) {
  const { register } = w.form;
  const line = w.values.lines[index];
  const errors = w.errors.lines?.[index];
  const { catalog } = w;
  const locked = (line?.lineId ?? "") !== "";
  // Chỉ chọn được khi đã có danh mục (đủ quyền, đã chọn NCC, tải xong, không rỗng).
  const pickable = catalog.canRead && catalog.items.length > 0;
  const usedSkus = new Set(
    w.values.lines.flatMap((l, i) => (i !== index && l.skuId !== "" ? [l.skuId] : [])),
  );
  const lockedId = `po-line-${index}-sku-locked`;
  const skuErrorId = `po-line-${index}-sku-error`;
  const descErrorId = `po-line-${index}-desc-error`;

  return (
    <div
      className={cn(
        "bg-bg-subtle rounded-[var(--r-sm)] border p-3",
        errors ? "border-danger/30" : "border-border-default",
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
              {line?.skuId || UI_LABELS.purchaseOrder.skuMissing}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          className="border-danger/30 text-danger hover:bg-danger/10 flex size-8 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
          aria-label={`Xóa dòng hàng ${index + 1}`}
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
            {/* BR-01 (docs 02 §6): chỉ chọn SKU trong danh mục của NCC. Dòng đã lưu (`lineId`)
                giữ SKU — BE `PUT /purchase-orders/{id}` báo 400 nếu đổi. */}
            <SkuCatalogCombobox
              items={catalog.items}
              value={line?.skuId ?? ""}
              usedSkus={usedSkus}
              onSelect={(item) => catalog.selectSku(index, item)}
              ariaLabel={C.skuAria(index + 1)}
              hasError={!!errors?.skuId}
              describedBy={errors?.skuId ? skuErrorId : locked ? lockedId : undefined}
              disabled={locked || !pickable}
            />
            {locked && (
              <p id={lockedId} className="text-ink-tertiary mt-0.5 text-[11px]">
                {C.skuLocked}
              </p>
            )}
            {line?.terms && <LineTermsHint terms={line.terms} poCurrency={w.values.currency} />}
            <FieldError id={skuErrorId}>{errors?.skuId?.message}</FieldError>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={`po-line-${index}-desc`}
              className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium"
            >
              Mô tả sản phẩm
            </label>
            <Textarea
              id={`po-line-${index}-desc`}
              {...register(`lines.${index}.description`)}
              placeholder={UI_LABELS.purchaseOrder.lineDescriptionPlaceholder}
              rows={2}
              maxLength={PO_LIMITS.lineDescriptionMax}
              aria-invalid={errors?.description ? true : undefined}
              aria-describedby={errors?.description ? descErrorId : undefined}
              className={cn(
                fieldClass(!!errors?.description).replace("h-8", ""),
                "min-h-[56px] resize-y py-2",
              )}
            />
            <p className="text-ink-tertiary mt-0.5 text-right text-[11px] tabular-nums">
              {line?.description.length ?? 0}/{PO_LIMITS.lineDescriptionMax}
            </p>
            <FieldError id={descErrorId}>{errors?.description?.message}</FieldError>
          </div>
        </div>
        <PoLineFields w={w} index={index} />
      </div>
    </div>
  );
}
