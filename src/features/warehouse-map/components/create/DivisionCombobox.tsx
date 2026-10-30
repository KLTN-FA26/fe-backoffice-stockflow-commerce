"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";

import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { VnDivision } from "@/lib/references/vn-divisions";

const F = UI_LABELS.warehouseMap.form;
const NOTE = "text-ink-tertiary px-3 py-2 text-xs";

/**
 * Ô chọn một đơn vị hành chính (tỉnh / thành hoặc phường / xã) gõ thẳng để lọc — `InputCombobox` theo
 * luật shared-components. Lọc phía cmdk theo tên, kèm `codename` không dấu để gõ "thu dau mot" vẫn ra.
 */
export function DivisionCombobox({
  id,
  label,
  placeholder,
  value,
  items,
  loading,
  disabled,
  error,
  onSelect,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** Tên đơn vị đang chọn ("" = chưa chọn). */
  value: string;
  items: readonly VnDivision[] | undefined;
  loading: boolean;
  disabled?: boolean;
  error?: string;
  onSelect: (division: VnDivision) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder={placeholder}
      searchPlaceholder={F.divisionSearch}
      ariaLabel={label}
      disabled={disabled}
      hasError={Boolean(error)}
      describedBy={error ? `${id}-error` : undefined}
    >
      <CommandList>
        {loading || !items ? (
          <p className={NOTE}>{F.divisionLoading}</p>
        ) : (
          <>
            <CommandEmpty className={NOTE}>{F.divisionEmpty}</CommandEmpty>
            <CommandGroup>
              {items.map((division) => (
                <CommandItem
                  key={division.code}
                  value={division.name}
                  keywords={[division.codename.replaceAll("_", " ")]}
                  className={COMBOBOX_ITEM_CLASS}
                  onSelect={() => {
                    onSelect(division);
                    setOpen(false);
                  }}
                >
                  {division.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </InputCombobox>
  );
}
