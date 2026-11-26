"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check } from "lucide-react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCatalogVariants, useProductOptions } from "@/lib/references/catalog-variants";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
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
  const items = products.data ?? [];
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
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.code && (
                      <span className="text-ink-tertiary ml-3 font-[family-name:var(--font-mono)] text-[11px]">
                        {item.code}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </InputCombobox>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sp-variant" className="text-ink-secondary text-xs font-medium">
          {P.variant}
        </Label>
        <select
          id="sp-variant"
          value={choices.some((v) => v.sku === value) ? value : ""}
          disabled={!product || variants.isPending || choices.length === 0}
          onChange={(event) => event.target.value && onSelect(event.target.value)}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          <option value="">
            {!product
              ? P.variantPlaceholder
              : variants.isPending
                ? P.variantLoading
                : variants.isError
                  ? P.variantFailed
                  : choices.length === 0
                    ? P.variantEmpty
                    : P.variantPlaceholder}
          </option>
          {choices.map((variant) => {
            const taken = priced.has(variant.sku.toUpperCase());
            return (
              <option key={variant.variantId} value={variant.sku} disabled={taken}>
                {`${variant.sku} — ${variant.name}${taken ? ` (${P.variantPriced})` : ""}`}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
