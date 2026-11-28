"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check } from "lucide-react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCatalogVariants, useProductOptions } from "@/lib/references/catalog-variants";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import {
  COMBOBOX_ITEM_CLASS,
  ComboboxMoreHint,
  InputCombobox,
} from "@/components/shared/InputCombobox";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";

import type { ProductOption } from "@/lib/references/catalog-variants";

const P = STANDARD_PRICE_UI_LABELS.picker;
const NOTE = "text-ink-tertiary px-3 py-2 text-xs";
// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Chọn quy cách của danh mục cho giá chuẩn: tìm sản phẩm (`GET /products?q=`) rồi chọn quy cách của nó
 * (`GET /products/{id}/variants`, đã bỏ SKU riêng của khách và quy cách đã ngừng). Quy cách đã có giá chuẩn vẫn hiện
 * nhưng không chọn được. Chọn xong ghi SKU vào ô SKU của form — ô đó vẫn nhập tay được (BE kiểm lại).
 * Chỉ hiện khi có `product-products:READ` + `product-variants:READ` (UI-only, BE re-check).
 */
export function VariantPicker({
  value,
  priced,
  onSelect,
}: {
  value: string;
  priced: ReadonlySet<string>;
  onSelect: (sku: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<ProductOption | null>(null);
  const term = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const products = useProductOptions(term, open);
  const variants = useCatalogVariants(product?.productId ?? null, true);
  const items = products.data?.items ?? [];
  const remaining = (products.data?.total ?? 0) - items.length;
  const choices = variants.data ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="sp-product" className="text-ink-secondary text-xs font-medium">
          {P.product}
        </Label>
        <InputCombobox
          id="sp-product"
          open={open}
          onOpenChange={setOpen}
          displayValue={product?.name ?? ""}
          placeholder={P.productPlaceholder}
          searchPlaceholder={P.productSearch}
          ariaLabel={P.product}
          search={search}
          onSearchChange={setSearch}
          shouldFilter={false}
          onClear={() => setProduct(null)}
        >
          <CommandList>
            {items.length === 0 ? (
              <p className={NOTE}>
                {products.isPending
                  ? P.productLoading
                  : products.isError
                    ? P.productFailed
                    : P.productEmpty}
              </p>
            ) : (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.productId}
                    value={item.productId}
                    // Chữ đang gõ chưa phải kết quả đang hiện (chờ debounce / còn dữ liệu cũ) → khoá dòng: Enter của
                    // `InputCombobox` chọn mục đầu chưa khoá, không được chọn nhầm sản phẩm của lần tìm trước
                    disabled={search !== term || products.isPlaceholderData}
                    className={COMBOBOX_ITEM_CLASS}
                    onSelect={() => {
                      setProduct(item);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        product?.productId === item.productId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{item.name}</span>
                      {item.code && (
                        <span className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-[11px]">
                          {item.code}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {items.length > 0 && remaining > 0 && <ComboboxMoreHint remaining={remaining} />}
        </InputCombobox>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sp-variant" className="text-ink-secondary text-xs font-medium">
          {P.variant}
        </Label>
        <Select
          value={choices.some((v) => v.sku === value) ? value : ""}
          disabled={!product || variants.isPending || choices.length === 0}
          onValueChange={(next) => next && onSelect(next)}
        >
          <SelectTrigger id="sp-variant" className={FORM_SELECT_CLASS}>
            <SelectValue
              placeholder={
                !product
                  ? P.variantPlaceholder
                  : variants.isPending
                    ? P.variantLoading
                    : variants.isError
                      ? P.variantFailed
                      : choices.length === 0
                        ? P.variantEmpty
                        : P.variantPlaceholder
              }
            />
          </SelectTrigger>
          <TitledSelectContent title={P.variant}>
            {choices.map((variant) => {
              const taken = priced.has(variant.sku.toUpperCase());
              return (
                <SelectItem key={variant.variantId} value={variant.sku} disabled={taken}>
                  {`${variant.sku} — ${variant.name}${taken ? ` (${P.variantPriced})` : ""}`}
                </SelectItem>
              );
            })}
          </TitledSelectContent>
        </Select>
      </div>
    </div>
  );
}
