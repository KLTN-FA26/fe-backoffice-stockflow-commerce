"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check, ChevronsUpDown } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { DropdownTitle } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "bg-bg-surface hover:bg-bg-surface hover:text-ink-primary disabled:bg-bg-muted h-8 w-full justify-between rounded-[var(--r-sm)] border px-2.5 text-left text-[0.8125rem] font-normal shadow-none",
            !value && "text-ink-tertiary",
            hasError
              ? "border-danger focus-visible:border-danger focus-visible:ring-danger/20"
              : "border-border-default focus-visible:border-brand focus-visible:ring-brand/20",
          )}
        >
          <span className={cn("truncate", value && "font-[family-name:var(--font-mono)]")}>
            {value || C.skuPlaceholder}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--radix-popover-trigger-width),28rem)] p-0"
        align="start"
      >
        <DropdownTitle>{"SKU"}</DropdownTitle>
        <Command>
          <CommandInput placeholder={C.skuSearch} />
          <CommandList>
            <CommandEmpty>{C.skuEmpty}</CommandEmpty>
            <CommandGroup>
              {options.map((item) => (
                <CommandItem
                  key={item.supplierItemId}
                  value={`${item.sku} ${item.supplierSkuCode ?? ""}`}
                  className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:hover:bg-bg-muted/60 data-selected:bg-transparent"
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
