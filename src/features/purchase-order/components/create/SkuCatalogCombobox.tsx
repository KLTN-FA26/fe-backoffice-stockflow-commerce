"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { SupplierItemRef } from "@/lib/references/supplier-items";

const C = UI_LABELS.purchaseOrder.catalog;

/**
 * Chọn SKU trong danh mục hàng của NCC (BR-01 docs 02 §6) — cùng kiểu `SupplierCombobox`.
 * Ẩn SKU đã có ở dòng khác (BE chặn SKU trùng trong một PO).
 */
export function SkuCatalogCombobox({
  items,
  value,
  usedSkus,
  onSelect,
  ariaLabel,
  hasError,
  describedBy,
  disabled,
}: {
  items: readonly SupplierItemRef[];
  value: string;
  /** SKU đang dùng ở các dòng khác. */
  usedSkus: ReadonlySet<string>;
  onSelect: (item: SupplierItemRef) => void;
  ariaLabel: string;
  hasError?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = items.filter((i) => i.sku === value || !usedSkus.has(i.sku));
  return (
    <InputCombobox
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder={C.skuPlaceholder}
      searchPlaceholder={C.skuSearch}
      ariaLabel={ariaLabel}
      hasError={hasError}
      describedBy={describedBy}
      disabled={disabled}
      mono
      contentClassName="w-[max(var(--radix-popover-trigger-width),28rem)]"
    >
      <CommandList>
        <CommandEmpty>{C.skuEmpty}</CommandEmpty>
        <CommandGroup className="p-0">
          {options.map((item) => (
            <CommandItem
              key={item.supplierItemId}
              value={`${item.sku} ${item.supplierSkuCode ?? ""}`}
              className={COMBOBOX_ITEM_CLASS}
              onSelect={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              <Check
                className={cn("mr-2 size-4", value === item.sku ? "opacity-100" : "opacity-0")}
              />
              <div className="min-w-0 flex-1">
                <div className="text-ink-primary font-[family-name:var(--font-mono)] text-xs">
                  {item.sku}
                </div>
                {item.supplierSkuCode && (
                  <div className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-[11px]">
                    {item.supplierSkuCode}
                  </div>
                )}
              </div>
              <div className="ml-3 text-right text-[11px] tabular-nums">
                <div className="text-ink-primary">{formatMoney(item.price, item.currency)}</div>
                <div className="text-ink-tertiary">
                  {C.moq(item.moq)} · {C.packSize(item.packSize)}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </InputCombobox>
  );
}
