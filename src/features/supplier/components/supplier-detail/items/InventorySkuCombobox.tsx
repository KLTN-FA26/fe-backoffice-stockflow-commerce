"use client";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { useSupplierCatalog } from "@/lib/references/supplier-items";
import { InventoryItemCombobox } from "@/components/shared/InventoryItemCombobox";

const P = SUPPLIER_ITEM_UI_LABELS.skuPicker;

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
 * Chọn SKU khi thêm mặt hàng vào danh mục NCC — `InventoryItemCombobox` dùng chung, thêm đúng một thứ riêng
 * của màn này: ẩn SKU NCC đã có (đọc đủ danh mục tới 200 dòng qua `useSupplierCatalog`; BE vẫn chặn trùng
 * `SUPPLIER_ITEM_DUPLICATE`). Màn khác KHÔNG ẩn SKU nào (SCRUM-492).
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
  const catalog = useSupplierCatalog(supplierId, true);
  const listed = new Set(catalog.data?.items.map((item) => item.sku));
  const showNotice = catalog.data?.truncated || (catalog.isError && !catalog.data);

  return (
    <InventoryItemCombobox
      id={id}
      value={value}
      onSelect={onSelect}
      ariaLabel={SUPPLIER_ITEM_UI_LABELS.field.sku}
      onBlur={onBlur}
      hasError={hasError}
      describedBy={describedBy}
      autoFocus={autoFocus}
      labels={P}
      hiddenSkus={listed}
      // Chờ danh mục NCC tải xong mới hiện gợi ý — chưa có danh mục thì không ẩn được SKU đã có (BE 409).
      holdResults={catalog.isPending}
      notice={
        showNotice ? (
          <p className="text-ink-tertiary border-border-default border-b px-3 py-1.5 text-xs">
            {catalog.data ? P.truncatedNotice : P.catalogFailedNotice}
          </p>
        ) : undefined
      }
    />
  );
}
