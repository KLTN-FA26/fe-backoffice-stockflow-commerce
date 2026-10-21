"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { SupplierOption } from "@/lib/references/supplier-options";

export function SupplierCombobox({
  value,
  onChange,
  suppliers,
  hasError,
  describedBy,
  placeholder = UI_LABELS.purchaseOrder.validation.supplierRequired,
}: {
  value: string;
  onChange: (v: string) => void;
  suppliers: readonly SupplierOption[];
  hasError?: boolean;
  /** id của dòng lỗi inline — để screen reader đọc lỗi khi focus vào combobox. */
  describedBy?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = suppliers.find((s) => s.supplierId === value);
  return (
    <InputCombobox
      open={open}
      onOpenChange={setOpen}
      displayValue={selected ? `${selected.code} — ${selected.name}` : ""}
      placeholder={placeholder}
      searchPlaceholder="Tìm NCC..."
      ariaLabel={UI_LABELS.purchaseOrder.supplier}
      hasError={hasError}
      describedBy={hasError ? describedBy : undefined}
    >
      <CommandList>
        <CommandEmpty>Không tìm thấy NCC.</CommandEmpty>
        <CommandGroup className="p-0">
          {suppliers.map((s) => (
            <CommandItem
              key={s.supplierId}
              value={`${s.code} ${s.name}`}
              className={COMBOBOX_ITEM_CLASS}
              onSelect={() => {
                onChange(s.supplierId);
                setOpen(false);
              }}
            >
              <Check
                className={cn("mr-2 size-4", value === s.supplierId ? "opacity-100" : "opacity-0")}
              />
              <span className="font-[family-name:var(--font-mono)] text-xs">{s.code}</span>
              <span className="ml-2 truncate">{s.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </InputCombobox>
  );
}
