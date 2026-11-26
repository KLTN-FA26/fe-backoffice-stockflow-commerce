"use client";

import { useState } from "react";

import { FormField } from "@/components/shared/FormField";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { CustomerSku } from "@/features/quote/types";

const LABEL = "Sản phẩm (SKU riêng)";
const STATUS_ROW = "text-[0.8125rem] px-3 py-2";

/** Tên người đọc được của SKU: tên sản phẩm kèm quy cách; chưa có tên thì chính mã. */
export function skuLabel(option: Pick<CustomerSku, "sku" | "name">): string {
  return option.name?.trim() || option.sku;
}

/**
 * Ô chọn SKU riêng của khách cho một dòng báo giá (14 §4.1 bước 2: Sale chọn SKU riêng của chính khách này).
 * Gõ tên hoặc mã để tìm (R1); trong ô và dòng danh sách là tên sản phẩm, mã SKU ở dòng phụ (R3). Chỉ có MỘT SKU hợp lệ
 * thì không cần chọn: hiện chữ chỉ đọc (R6) — dòng được điền SKU đó ở `QuoteLineEditor`.
 */
export function QuoteSkuField({
  id,
  value,
  onChange,
  onBlur,
  options,
  onlyOption,
  error,
}: {
  id: string;
  value: string;
  onChange: (sku: string) => void;
  onBlur?: () => void;
  /** Các SKU còn chọn được cho dòng này (đã bỏ SKU ở dòng khác: BE mỗi SKU chỉ một dòng). */
  options: readonly CustomerSku[];
  /** Khách chỉ có đúng một SKU báo giá được. */
  onlyOption: CustomerSku | null;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.sku === value);
  const hint = value && (chosen?.name || onlyOption?.name) ? value : undefined;

  if (onlyOption)
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span id={`${id}-label`} className="text-ink-secondary text-xs font-medium">
          {LABEL}
        </span>
        <p id={id} aria-labelledby={`${id}-label`} className="text-ink-primary text-[0.8125rem]">
          <span className="font-medium">{skuLabel(onlyOption)}</span>
          <span className="text-ink-tertiary mt-0.5 block font-[family-name:var(--font-mono)] text-xs">
            {onlyOption.sku}
          </span>
        </p>
      </div>
    );

  return (
    <FormField
      id={id}
      label={LABEL}
      required
      error={error}
      hint={hint && <span className="font-[family-name:var(--font-mono)]">{hint}</span>}
    >
      <InputCombobox
        id={id}
        open={open}
        onOpenChange={setOpen}
        displayValue={chosen ? skuLabel(chosen) : value}
        placeholder="Chọn sản phẩm…"
        searchPlaceholder="Gõ tên sản phẩm hoặc mã SKU…"
        ariaLabel={LABEL}
        hasError={!!error}
        describedBy={
          [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") ||
          undefined
        }
        onBlur={onBlur}
      >
        <CommandList>
          <CommandEmpty className={`text-ink-tertiary ${STATUS_ROW} text-left`}>
            Không có sản phẩm khớp.
          </CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.variantId}
                value={option.sku}
                keywords={[skuLabel(option)]}
                onSelect={() => {
                  onChange(option.sku);
                  setOpen(false);
                }}
                className={`${COMBOBOX_ITEM_CLASS} flex-col items-start gap-0`}
              >
                <span className="text-ink-primary text-[0.8125rem] font-medium">
                  {skuLabel(option)}
                </span>
                <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                  {option.sku}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </InputCombobox>
    </FormField>
  );
}
