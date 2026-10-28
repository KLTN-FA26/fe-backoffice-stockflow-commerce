"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { NO_DEFAULT_SUPPLIER } from "../../purchasing-form";
import { Field } from "./Field";
import { DefaultSupplierValue } from "./VariantPurchasingSupplier";

import type { Control } from "react-hook-form";
import type { SkuSupplierRef } from "@/lib/references/sku-suppliers";
import type { PurchasingFormValues } from "../../purchasing-form";
import type { SupplierLookup } from "./VariantPurchasingSupplier";

const L = UI_LABELS.skuPurchasing;
const F = L.form;
const ID = "pu-supplier";

interface Option {
  value: string;
  label: string;
  disabled: boolean;
}

/**
 * Lựa chọn NCC mặc định theo luật BE `SkuPurchasingService`: ĐỔI sang NCC khác thì NCC phải ACTIVE;
 * GIỮ NGUYÊN NCC hiện có thì không kiểm lại (kể cả NCC đã ngừng / không còn trong danh mục) — nên NCC
 * hiện có luôn là một lựa chọn để không bị thay lặng lẽ; xoá (null) luôn được.
 */
function optionsOf(currentId: string | null, rows: readonly SkuSupplierRef[]): Option[] {
  const name = (r: SkuSupplierRef) => L.supplier.name(r.supplierCode, r.supplierName);
  const options: Option[] = [{ value: NO_DEFAULT_SUPPLIER, label: F.noSupplier, disabled: false }];
  if (currentId !== null) {
    const row = rows.find((r) => r.supplierId === currentId);
    const label = !row
      ? F.currentNotListed(currentId)
      : row.supplierStatus === "ACTIVE"
        ? name(row)
        : F.currentInactive(name(row));
    options.push({ value: currentId, label, disabled: false });
  }
  for (const row of rows) {
    if (row.supplierId === currentId) continue;
    const active = row.supplierStatus === "ACTIVE";
    options.push({
      value: row.supplierId,
      label: active ? name(row) : F.inactiveOption(name(row)),
      disabled: !active,
    });
  }
  return options;
}

/**
 * Ô NCC mặc định của form. Chọn được chỉ khi có `procurement-supplier-items:READ` VÀ danh mục NCC của SKU
 * đã tải xong; thiếu quyền / đang tải / tải lỗi → chỉ đọc, form giữ nguyên `defaultSupplierId` đang có
 * (không bao giờ thành null vì thiếu thông tin NCC).
 */
export function PurchasingSupplierField({
  control,
  currentId,
  lookup,
  rows,
  error,
}: {
  control: Control<PurchasingFormValues>;
  currentId: string | null;
  lookup: SupplierLookup;
  /** Danh mục NCC của SKU khi chọn được; null → ô chỉ đọc. */
  rows: readonly SkuSupplierRef[] | null;
  error?: string;
}) {
  if (rows === null) {
    return (
      <div className="space-y-1">
        <p className="text-ink-secondary text-xs font-medium">{L.field.defaultSupplier}</p>
        <div className="text-[0.8125rem]">
          <DefaultSupplierValue supplierId={currentId} lookup={lookup} />
        </div>
        <p className="text-ink-tertiary text-xs">{F.supplierLocked}</p>
        {error && <p className="text-danger text-xs">{error}</p>}
      </div>
    );
  }
  const options = optionsOf(currentId, rows);
  return (
    <Field label={L.field.defaultSupplier} id={ID} hint={F.supplierHint} error={error}>
      <Controller
        control={control}
        name="defaultSupplierId"
        render={({ field }) => (
          <FormSelect value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={ID} className={FORM_SELECT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <TitledSelectContent title={L.field.defaultSupplier}>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </FormSelect>
        )}
      />
    </Field>
  );
}
