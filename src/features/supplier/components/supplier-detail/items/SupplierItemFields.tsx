"use client";

import { cn } from "cn";
import { Controller } from "react-hook-form";

import { INVENTORY_ITEM_PERMISSIONS, SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { InventorySkuCombobox } from "./InventorySkuCombobox";
import { PreferredField } from "./PreferredField";
import { ITEM_FIELD_HINTS, ITEM_TEXT_FIELDS } from "./supplier-item-form-values";
import { SupplierItemField } from "./SupplierItemField";

import type { UseFormReturn } from "react-hook-form";
import type { SupplierItem, SupplierItemFormValues } from "@/features/supplier/types";

const L = SUPPLIER_ITEM_UI_LABELS;

/**
 * Các ô của form danh mục hàng NCC. Thêm mới + có quyền đọc hồ sơ hàng tồn → SKU chọn qua
 * `InventorySkuCombobox`; không có quyền → gõ tay kèm dòng giải thích; sửa → SKU khoá.
 */
export function SupplierItemFields({
  form,
  item,
  supplierId,
}: {
  form: UseFormReturn<SupplierItemFormValues>;
  item: SupplierItem | null;
  supplierId: string;
}) {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission inventory-inventory-items:READ)
  const pickSku = !item && can(INVENTORY_ITEM_PERMISSIONS.read);
  const { errors } = form.formState;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {ITEM_TEXT_FIELDS.map(({ name, required, mono, numeric, wide }) => {
          const id = `supplier-item-${name}`;
          const message = errors[name]?.message;
          const isSku = name === "sku";
          const manualSku = isSku && !item && !pickSku;
          const note = message ?? (manualSku ? L.skuPicker.manualNotice : ITEM_FIELD_HINTS[name]);
          const locked = isSku && item !== null;
          const describedBy = note ? `${id}-note` : undefined;
          return (
            <SupplierItemField
              key={name}
              id={id}
              label={L.field[name]}
              required={required}
              wide={wide}
              note={note}
              isError={message !== undefined}
            >
              {isSku && pickSku ? (
                <Controller
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <InventorySkuCombobox
                      id={id}
                      supplierId={supplierId}
                      value={field.value}
                      onSelect={(sku) => field.onChange(sku)}
                      onBlur={field.onBlur}
                      hasError={message !== undefined}
                      describedBy={describedBy}
                      autoFocus
                    />
                  )}
                />
              ) : (
                <Input
                  id={id}
                  {...form.register(name, name === "packSize" ? { deps: "moq" } : undefined)}
                  // SKU khoá khi sửa (BE `update` bỏ qua `sku`) → ô đầu nhận focus là mã NCC
                  readOnly={locked}
                  autoFocus={item ? name === "supplierSkuCode" : isSku}
                  inputMode={numeric ? "decimal" : undefined}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={describedBy}
                  className={cn(
                    FORM_INPUT_CLASS,
                    mono && "font-[family-name:var(--font-mono)]",
                    isSku && "uppercase",
                    numeric && "text-right tabular-nums",
                    locked && "bg-bg-muted text-ink-secondary",
                  )}
                />
              )}
            </SupplierItemField>
          );
        })}
      </div>
      <PreferredField form={form} item={item} />
    </>
  );
}
