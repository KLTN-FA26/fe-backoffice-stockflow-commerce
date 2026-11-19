"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { useCustomerSkus } from "@/lib/references/customer-skus";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerPriceFormValues } from "../form";

const F = CUSTOMER_PRICE_UI_LABELS.form;
const ID = "cp-sku";
const LIST_ID = "cp-sku-suggestions";
const MONO = "font-[family-name:var(--font-mono)]";

/**
 * SKU của bảng giá. Tạo: ô nhập tay LUÔN dùng được (BE chuẩn hoá + chỉ nhận SKU riêng của chính khách →
 * CUSTOMER_SKU_REQUIRED / VARIANT_NOT_FOUND, 13 BR-02); gợi ý SKU riêng của khách (`GET /customer-skus`)
 * CHỈ khi có `product-variants:READ` — không có quyền thì không gọi API, không chặn việc tạo giá.
 * Sửa: SKU là định danh của bảng giá → chỉ đọc.
 */
export function SkuField({
  form,
  mode,
  customerId,
  canSuggest,
}: {
  form: UseFormReturn<CustomerPriceFormValues>;
  mode: "create" | "edit";
  customerId: string;
  canSuggest: boolean;
}) {
  const suggestions = useCustomerSkus(customerId, canSuggest && mode === "create");
  const error = form.formState.errors.sku?.message;

  if (mode === "edit") {
    return (
      <div className="space-y-1">
        <p className="text-ink-secondary text-xs font-medium">{F.sku}</p>
        <p className={MONO}>{form.getValues("sku")}</p>
        <p className="text-ink-tertiary text-xs">{F.skuLocked}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={ID} className="text-ink-secondary text-xs font-medium">
        {F.sku}
      </Label>
      <Input
        id={ID}
        autoComplete="off"
        list={canSuggest ? LIST_ID : undefined}
        {...form.register("sku")}
        className={`${FORM_INPUT_CLASS} ${MONO}`}
      />
      {canSuggest && (
        <datalist id={LIST_ID}>
          {(suggestions.data ?? [])
            .filter((item) => item.status !== "OBSOLETE")
            .map((item) => (
              <option key={item.variantId} value={item.sku}>
                {item.name}
              </option>
            ))}
        </datalist>
      )}
      <p className="text-ink-tertiary text-xs">{F.skuHint}</p>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
