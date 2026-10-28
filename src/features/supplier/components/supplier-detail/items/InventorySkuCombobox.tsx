"use client";

import { useState } from "react";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventoryItemOptions } from "@/lib/references/inventory-item-options";
import { useSupplierCatalog } from "@/lib/references/supplier-items";
import { InputCombobox } from "@/components/shared/InputCombobox";
import { CommandGroup, CommandList } from "@/components/ui/command";

import { InventorySkuOption } from "./InventorySkuOption";
import { InventorySkuOptionsStatus } from "./InventorySkuOptionsStatus";

const P = SUPPLIER_ITEM_UI_LABELS.skuPicker;
// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;

interface InventorySkuComboboxProps {
  id: string;
  supplierId: string;
  value: string;
  onSelect: (sku: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}

/**
 * Chọn SKU từ hồ sơ hàng tồn (BE `GET /inventory/items?q=`, tìm theo SKU hoặc mã vạch, BE lọc) khi
 * thêm mặt hàng vào danh mục NCC — cùng kiểu `SkuCatalogCombobox` của form PO. Ẩn SKU NCC đã có
 * (đọc đủ danh mục tới 200 dòng qua `useSupplierCatalog`; BE vẫn chặn trùng `SUPPLIER_ITEM_DUPLICATE`).
 */
export function InventorySkuCombobox({
  id,
  supplierId,
  value,
  onSelect,
  onBlur,
  hasError,
  describedBy,
  autoFocus,
}: InventorySkuComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const options = useInventoryItemOptions(q, open);
  const catalog = useSupplierCatalog(supplierId, true);
  const listed = new Set(catalog.data?.items.map((item) => item.sku));
  // Chờ danh mục NCC tải xong mới hiện gợi ý — chưa có danh mục thì không ẩn được SKU đã có (BE 409).
  const catalogLoading = catalog.isPending;
  const items = catalogLoading
    ? []
    : (options.data?.items ?? []).filter((item) => !listed.has(item.sku));
  const hasMore = options.data?.hasMore ?? false;

  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={value}
      placeholder={P.placeholder}
      searchPlaceholder={P.search}
      ariaLabel={SUPPLIER_ITEM_UI_LABELS.field.sku}
      // BE lọc theo `q` → tắt lọc phía cmdk
      search={search}
      onSearchChange={setSearch}
      shouldFilter={false}
      hasError={hasError}
      describedBy={describedBy}
      autoFocus={autoFocus}
      mono
      onBlur={onBlur}
    >
      {(catalog.data?.truncated || (catalog.isError && !catalog.data)) && (
        <p className="text-ink-tertiary border-border-default border-b px-3 py-1.5 text-xs">
          {catalog.data ? P.truncatedNotice : P.catalogFailedNotice}
        </p>
      )}
      <CommandList>
        {items.length === 0 ? (
          <InventorySkuOptionsStatus
            isPending={options.isPending || catalogLoading}
            // Lỗi khi đã có kết quả cũ (placeholder) → vẫn hiện kết quả cũ, không chặn
            isError={options.isError && !options.data}
            hasMore={hasMore}
            onRetry={() => void options.refetch()}
          />
        ) : (
          <CommandGroup>
            {items.map((item) => (
              <InventorySkuOption
                key={item.id}
                item={item}
                selected={value === item.sku}
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
            {P.moreResults}
          </p>
        )}
      </CommandList>
    </InputCombobox>
  );
}
