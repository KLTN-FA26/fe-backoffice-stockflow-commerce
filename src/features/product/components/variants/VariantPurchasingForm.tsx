"use client";

import { UI_LABELS } from "@/constants";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Field } from "./Field";
import { PurchasingSupplierField } from "./PurchasingSupplierField";
import { usePurchasingEditor } from "./usePurchasingEditor";

import type { Refetch } from "@/lib/api/fresh-refetch";
import type { SkuSupplierRef } from "@/lib/references/sku-suppliers";
import type { PurchasingFormValues } from "../../purchasing-form";
import type { SkuPurchasing } from "../../purchasing-schemas";
import type { SupplierLookup } from "./VariantPurchasingSupplier";

const L = UI_LABELS.skuPurchasing;
const NUMBER_INPUT = `${FORM_INPUT_CLASS} text-right tabular-nums`;

type TextField = Exclude<keyof PurchasingFormValues, "defaultSupplierId">;
const FIELD_LABEL: Record<TextField, keyof typeof L.field> = {
  referencePurchasePrice: "referencePrice",
  referencePurchaseCurrency: "currency",
  leadTimeDays: "leadTimeDays",
  moq: "moq",
};
const HINT: Partial<Record<TextField, string>> = {
  referencePurchasePrice: L.form.priceHint,
  referencePurchaseCurrency: L.form.currencyHint,
  leadTimeDays: L.form.leadTimeHint,
};
/** Giá và tiền tệ đi cùng nhau (BE `ItemPurchasingRules`) — sửa một ô thì kiểm lại ô kia. */
const PAIRED: Partial<Record<TextField, TextField[]>> = {
  referencePurchasePrice: ["referencePurchaseCurrency"],
  referencePurchaseCurrency: ["referencePurchasePrice"],
};

/** Form sửa thông tin mua hàng — bố cục; trạng thái + luật lưu ở `usePurchasingEditor`. */
export function VariantPurchasingForm({
  productId,
  variantId,
  latest,
  reload,
  lookup,
  supplierRows,
  canSave,
  onDone,
}: {
  productId: string;
  variantId: string;
  /** Bản mới nhất trong cache — chỉ để biết đã có version mới hơn bản đang sửa. */
  latest: SkuPurchasing;
  reload: Refetch<SkuPurchasing>;
  lookup: SupplierLookup;
  /** Danh mục NCC của SKU khi được chọn NCC; null → giữ nguyên NCC mặc định. */
  supplierRows: readonly SkuSupplierRef[] | null;
  canSave: boolean;
  onDone: () => void;
}) {
  const editor = usePurchasingEditor({
    productId,
    variantId,
    latest,
    reload,
    supplierEditable: supplierRows !== null,
    onDone,
  });
  const { form, conflict, outdated, error, isPending, reloading, reloadFailed } = editor;
  const { errors, isValid } = form.formState;

  return (
    <form
      className="space-y-3"
      aria-label={L.title}
      onSubmit={(e) => {
        e.preventDefault();
        void editor.submit();
      }}
    >
      <PurchasingSupplierField
        control={form.control}
        currentId={editor.base.defaultSupplierId}
        lookup={lookup}
        rows={supplierRows}
        error={errors.defaultSupplierId?.message}
      />
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(FIELD_LABEL) as TextField[]).map((name) => (
          <Field
            key={name}
            label={L.field[FIELD_LABEL[name]]}
            id={`pu-${name}`}
            hint={HINT[name]}
            error={errors[name]?.message}
          >
            <Input
              id={`pu-${name}`}
              inputMode={name === "referencePurchaseCurrency" ? "text" : "decimal"}
              {...form.register(name, { deps: PAIRED[name] })}
              className={name === "referencePurchaseCurrency" ? FORM_INPUT_CLASS : NUMBER_INPUT}
            />
          </Field>
        ))}
      </div>
      {outdated && !conflict && (
        <p role="status" className="text-warning text-xs">
          {L.form.outdated}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      {(conflict || outdated) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reloading}
            onClick={() => void editor.reloadLatest()}
          >
            {reloading ? L.form.reloading : L.form.reload}
          </Button>
          <span className="text-ink-tertiary text-xs">{L.form.reloadWarning}</span>
          {reloadFailed && (
            <p role="alert" className="text-danger w-full text-xs">
              {L.form.reloadFailed}
            </p>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {/* Đang lưu thì không huỷ: đóng form lúc này sẽ nuốt mất lỗi nếu lần lưu thất bại */}
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onDone}>
          {L.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={!canSave || !isValid || isPending}>
          {isPending ? L.saving : L.save}
        </Button>
      </div>
    </form>
  );
}
