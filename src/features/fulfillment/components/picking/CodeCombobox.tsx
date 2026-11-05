"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check } from "lucide-react";

import { PICK_LINE_LABELS } from "@/constants";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { CodeOption } from "@/features/fulfillment/pick-line-selectors";

/**
 * Combobox chọn một mã (vị trí / SKU / barcode) gõ thẳng vào ô — thay ô quét trên desktop (máy chưa có
 * máy quét). Lọc ở client trên danh sách đã tải. Giá trị gửi đi y như mã quét được, nên sau này đổi sang ô
 * quét không đổi hợp đồng BE.
 */
export function CodeCombobox({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  hasError,
  describedBy,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly CodeOption[];
  placeholder: string;
  hasError?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={selected?.value ?? value}
      placeholder={placeholder}
      searchPlaceholder={PICK_LINE_LABELS.codeSearch}
      ariaLabel={label}
      hasError={hasError}
      describedBy={describedBy}
      autoFocus={autoFocus}
      mono
    >
      <CommandList>
        <CommandEmpty>{PICK_LINE_LABELS.noCodeMatch}</CommandEmpty>
        <CommandGroup className="p-0">
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={option.label}
              className={COMBOBOX_ITEM_CLASS}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <Check
                className={cn("mr-2 size-4", option.value === value ? "opacity-100" : "opacity-0")}
              />
              <span className="font-[family-name:var(--font-mono)] text-xs">{option.label}</span>
              {option.hint && (
                <span className="text-ink-tertiary ml-auto pl-2 text-xs">{option.hint}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </InputCombobox>
  );
}
