"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check, ChevronsUpDown } from "lucide-react";

import { UI_LABELS } from "@/constants";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={UI_LABELS.purchaseOrder.supplier}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? describedBy : undefined}
          className={cn(
            "bg-bg-surface hover:bg-bg-surface hover:text-ink-primary h-8 w-full justify-between rounded-[var(--r-sm)] border px-2.5 text-left text-[0.8125rem] font-normal shadow-none",
            !value && "text-ink-tertiary",
            hasError
              ? "border-danger focus-visible:border-danger focus-visible:ring-danger/20"
              : "border-border-default focus-visible:border-brand focus-visible:ring-brand/20",
          )}
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.name}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm NCC..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy NCC.</CommandEmpty>
            <CommandGroup>
              {suppliers.map((s) => (
                <CommandItem
                  key={s.supplierId}
                  value={`${s.code} ${s.name}`}
                  className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:hover:bg-bg-muted/60 data-selected:bg-transparent"
                  onSelect={() => {
                    onChange(s.supplierId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === s.supplierId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-[family-name:var(--font-mono)] text-xs">{s.code}</span>
                  <span className="ml-2 truncate">{s.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
