"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventoryItemOptions } from "@/lib/references/inventory-item-options";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerPriceFormValues } from "../form";

const F = CUSTOMER_PRICE_UI_LABELS.form;
const ID = "cp-sku";
const LIST_ID = "cp-sku-suggestions";
// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;
const MONO = "font-[family-name:var(--font-mono)]";

/**
 * SKU của bảng giá. Tạo: ô nhập tay LUÔN dùng được (BE chuẩn hoá + kiểm SKU có trong danh mục →
 * VARIANT_NOT_FOUND); gợi ý từ hồ sơ hàng tồn (`GET /inventory/items?q=`) CHỈ khi có
 * `inventory-inventory-items:READ` — không có quyền thì không gọi API, không chặn việc tạo giá.
 * Sửa: SKU là định danh của bảng giá → chỉ đọc.
 */
export function SkuField({
  form,
  mode,
  canSuggest,
}: {
  form: UseFormReturn<CustomerPriceFormValues>;
  mode: "create" | "edit";
  canSuggest: boolean;
}) {
  const typed = useDebouncedValue(form.watch("sku"), SEARCH_DEBOUNCE_MS);
  const suggestions = useInventoryItemOptions(
    typed,
    canSuggest && mode === "create" && typed.trim() !== "",
  );
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
          {(suggestions.data?.items ?? []).map((item) => (
            <option key={item.id} value={item.sku} />
          ))}
        </datalist>
      )}
      <p className="text-ink-tertiary text-xs">{F.skuHint}</p>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
