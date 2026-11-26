"use client";

import { PRICE_TIER_LIMITS, STANDARD_PRICE_UI_LABELS } from "@/constants";
import { normalizeSku } from "@/lib/pricing/price-tier-form";
import { PriceTierEditor } from "@/components/backoffice/PriceTierEditor";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useStandardPrice } from "../queries";
import { useStandardPriceEditor } from "./useStandardPriceEditor";
import { VariantPicker } from "./VariantPicker";

import type { StandardPrice } from "../schemas";

const L = STANDARD_PRICE_UI_LABELS;
const F = L.form;
const MONO = "font-[family-name:var(--font-mono)]";
const NOTE = "text-ink-tertiary text-xs";

/** Giá chuẩn đang mở form: tạo mới, hoặc sửa đúng bản trên danh sách (danh tính chụp lúc mở). */
export type StandardPriceTarget = { mode: "create" } | { mode: "edit"; price: StandardPrice };

export const targetKey = (t: StandardPriceTarget) =>
  t.mode === "create" ? "create" : `edit|${t.price.sku}`;

/**
 * Dialog tạo / sửa giá chuẩn: quy cách (chỉ khi tạo — chọn từ danh mục hoặc nhập SKU), bậc giá (chung với bảng giá
 * khách), ghi chú. Sửa: SKU là danh tính, không đổi; 409 OPTIMISTIC_LOCK cho tải bản mới nhất (bỏ bản nháp).
 */
export function StandardPriceFormDialog({
  target,
  priced,
  canBrowseVariants,
  onClose,
}: {
  target: StandardPriceTarget;
  /** SKU đã có giá chuẩn — ô chọn quy cách không cho chọn lại. */
  priced: ReadonlySet<string>;
  /** `product-products:READ` + `product-variants:READ` — có thì hiện ô chọn sản phẩm / quy cách. */
  canBrowseVariants: boolean;
  onClose: () => void;
}) {
  const initial = target.mode === "edit" ? target.price : undefined;
  // Bản mới nhất của đúng SKU (chỉ khi sửa) — để "Tải dữ liệu mới nhất" sau 409
  const detail = useStandardPrice(initial?.sku ?? null, target.mode === "edit");
  const editor = useStandardPriceEditor({
    mode: target.mode,
    initial,
    reload: target.mode === "edit" ? detail.refetch : undefined,
    onSaved: onClose,
  });
  const { form } = editor;
  const { isValid, errors } = form.formState;
  const sku = form.watch("sku");
  const hasInexact = form.watch("tiers").some((t) => t.inexact);

  return (
    <FormDialog open onOpenChange={(open) => !open && !editor.isPending && onClose()}>
      <FormDialogBody
        title={initial ? F.editTitle(initial.sku) : F.createTitle}
        description={F.description}
        submitLabel={editor.isPending ? F.saving : F.save}
        canSubmit={isValid}
        isPending={editor.isPending}
        error={editor.error}
        onSubmit={() => void editor.submit()}
        onCancel={onClose}
      >
        {initial ? (
          <div className="space-y-1">
            <p className="text-ink-secondary text-xs font-medium">{L.field.sku}</p>
            <p className={MONO}>{initial.sku}</p>
            {(initial.productName || initial.variantName) && (
              <p className="text-ink-secondary text-xs">
                {[initial.productName, initial.variantName].filter(Boolean).join(" — ")}
              </p>
            )}
            <p className={NOTE}>{F.skuLocked}</p>
          </div>
        ) : (
          <>
            {canBrowseVariants && (
              <VariantPicker
                value={normalizeSku(sku)}
                priced={priced}
                onSelect={(next) => form.setValue("sku", next, { shouldValidate: true })}
              />
            )}
            <div className="space-y-1">
              <Label htmlFor="sp-sku" className="text-ink-secondary text-xs font-medium">
                {canBrowseVariants ? L.picker.manualSku : L.field.sku}
              </Label>
              <Input
                id="sp-sku"
                autoComplete="off"
                {...form.register("sku")}
                className={`${FORM_INPUT_CLASS} ${MONO}`}
              />
              <p className={NOTE}>{L.picker.manualHint}</p>
              {errors.sku && <p className="text-danger text-xs">{errors.sku.message}</p>}
            </div>
          </>
        )}
        {hasInexact && (
          <p role="note" className="text-warning text-xs">
            {F.inexactWarning}
          </p>
        )}
        <PriceTierEditor form={form} idPrefix="sp" />
        <div className="space-y-1">
          <Label htmlFor="sp-note" className="text-ink-secondary text-xs font-medium">
            {L.field.note}
          </Label>
          <Textarea
            id="sp-note"
            rows={2}
            maxLength={PRICE_TIER_LIMITS.noteMax + 1}
            {...form.register("note")}
          />
          {errors.note && <p className="text-danger text-xs">{errors.note.message}</p>}
        </div>
        {editor.stale && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={editor.reloading}
              onClick={() => void editor.reloadLatest()}
            >
              {editor.reloading ? F.reloading : F.reload}
            </Button>
            <span className={NOTE}>{F.reloadWarning}</span>
            {editor.reloadFailed && (
              <p role="alert" className="text-danger w-full text-xs">
                {F.reloadFailed}
              </p>
            )}
          </div>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
