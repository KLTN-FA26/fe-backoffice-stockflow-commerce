"use client";

import { useState } from "react";

import { INVENTORY_ITEM_PICKER_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventoryItemOptions } from "@/lib/references/inventory-item-options";
import { InputCombobox } from "@/components/shared/InputCombobox";
import { CommandGroup, CommandList } from "@/components/ui/command";

import { InventoryItemOption } from "./InventoryItemOption";
import { InventoryItemOptionsStatus } from "./InventoryItemOptionsStatus";

import type { ReactNode } from "react";
import type { InventoryItemPickerLabels } from "@/constants";

// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;

interface InventoryItemComboboxProps {
  id: string;
  value: string;
  onSelect: (sku: string) => void;
  ariaLabel: string;
  onBlur?: () => void;
  hasError?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  /** Nhãn riêng của màn gọi; mặc định `INVENTORY_ITEM_PICKER_LABELS`. */
  labels?: InventoryItemPickerLabels;
  /** SKU màn gọi không muốn thấy (vd đã có trong danh mục NCC). Mặc định: hiện mọi hồ sơ hàng tồn. */
  hiddenSkus?: ReadonlySet<string>;
  /** Màn gọi còn đang tải dữ liệu để loại SKU → chưa hiện gợi ý (tránh nháy ra SKU rồi mới bị ẩn). */
  holdResults?: boolean;
  /** Dòng giải thích đầu dropdown (vd danh mục NCC quá dài nên không ẩn hết SKU đã có). */
  notice?: ReactNode;
  contentClassName?: string;
}

/**
 * Chọn SKU từ hồ sơ hàng tồn (BE `GET /inventory/items?q=`, tìm theo SKU hoặc mã vạch, BE lọc) — dùng chung
 * cho mọi màn cần chọn SKU. Mặc định hiện MỌI hồ sơ hàng tồn; việc loại bớt SKU (nếu có) là của màn gọi qua
 * `hiddenSkus` / `holdResults` / `notice`, không nằm trong component này.
 */
export function InventoryItemCombobox({
  id,
  value,
  onSelect,
  ariaLabel,
  onBlur,
  hasError,
  describedBy,
  autoFocus,
  labels = INVENTORY_ITEM_PICKER_LABELS,
  hiddenSkus,
  holdResults = false,
  notice,
  contentClassName,
}: InventoryItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const options = useInventoryItemOptions(q, open);
  const items = holdResults
    ? []
    : (options.data?.items ?? []).filter((item) => !hiddenSkus?.has(item.sku));
  const hasMore = options.data?.hasMore ?? false;

  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder={labels.placeholder}
      searchPlaceholder={labels.search}
      ariaLabel={ariaLabel}
      // BE lọc theo `q` → tắt lọc phía cmdk
      search={search}
      onSearchChange={setSearch}
      shouldFilter={false}
      hasError={hasError}
      describedBy={describedBy}
      autoFocus={autoFocus}
      mono
      onBlur={onBlur}
      contentClassName={contentClassName}
    >
      {notice}
      <CommandList>
        {items.length === 0 ? (
          <InventoryItemOptionsStatus
            isPending={options.isPending || holdResults}
            // Lỗi khi đã có kết quả cũ (placeholder) → vẫn hiện kết quả cũ, không chặn
            isError={options.isError && !options.data}
            hasMore={hasMore}
            onRetry={() => void options.refetch()}
            labels={labels}
          />
        ) : (
          <CommandGroup>
            {items.map((item) => (
              <InventoryItemOption
                key={item.id}
                item={item}
                selected={value === item.sku}
                barcodeLabel={labels.barcode}
                onSelect={() => {
                  onSelect(item.sku);
                  setOpen(false);
                }}
              />
            ))}
          </CommandGroup>
        )}
        {items.length > 0 && hasMore && (
          <p className="text-ink-tertiary border-border-default border-t px-3 py-1.5 text-xs">
            {labels.moreResults}
          </p>
        )}
      </CommandList>
    </InputCombobox>
  );
}
