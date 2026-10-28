"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { currencyFractionDigits } from "@/lib/format";
import { formatMoney, isUnitPriceRequired } from "@/features/purchase-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass, lineTotal } from "./helpers";
import { LineTermsHint } from "./LineTermsHint";
import { PoLineDescriptionPopover } from "./PoLineDescriptionPopover";
import { SkuCatalogCombobox } from "./SkuCatalogCombobox";

import type { CreatePoWizard } from "./useCreateForm";

const C = UI_LABELS.purchaseOrder.catalog;
const S = UI_LABELS.purchaseOrder.linesStep;
const NUM = "text-right font-[family-name:var(--font-mono)] tabular-nums";

type NumField = "orderedQty" | "unitPrice" | "taxRate";

/** Một dòng của bảng dòng hàng — mọi ô `register` vào react-hook-form, lỗi hiện ngay dưới ô. */
export function PoLineRow({
  w,
  index,
  onRemove,
}: {
  w: CreatePoWizard;
  index: number;
  onRemove: () => void;
}) {
  const { register } = w.form;
  const { catalog } = w;
  const currency = w.values.currency;
  const line = w.values.lines[index];
  const errors = w.errors.lines?.[index];
  const n = index + 1;
  const locked = (line?.lineId ?? "") !== "";
  // Chỉ chọn được khi đã có danh mục (đủ quyền, đã chọn NCC, tải xong, không rỗng).
  const pickable = catalog.canRead && catalog.items.length > 0;
  const usedSkus = new Set(
    w.values.lines.flatMap((l, i) => (i !== index && l.skuId !== "" ? [l.skuId] : [])),
  );
  // BE `Money` làm tròn theo số chữ số thập phân của tiền tệ (VND: số nguyên).
  const priceDigits = currencyFractionDigits(currency);
  // BE #118: dòng mới cùng tiền tệ danh mục được để trống giá (BE lấy giá danh mục)
  const priceRequired = line ? isUnitPriceRequired(line, currency) : true;
  const skuErrorId = `po-line-${index}-sku-error`;
  const lockedId = `po-line-${index}-sku-locked`;

  const numCell = (
    name: NumField,
    key: string,
    aria: string,
    extra: React.ComponentProps<"input">,
  ) => {
    const error = errors?.[name]?.message;
    const errorId = `po-line-${index}-${key}-error`;
    return (
      <td className="px-2 py-2 align-top">
        <Input
          id={`po-line-${index}-${key}`}
          {...register(`lines.${index}.${name}`)}
          type="number"
          aria-label={aria}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(fieldClass(!!error), NUM)}
          {...extra}
        />
        <FieldError id={errorId}>{error}</FieldError>
      </td>
    );
  };

  return (
    <tr className={cn("border-b border-(--table-line) last:border-b-0", errors && "bg-danger/5")}>
      <td className="text-ink-tertiary px-2 pt-3.5 text-right align-top text-xs tabular-nums">
        {n}
      </td>
      <td className="min-w-0 px-2 py-2 align-top">
        {/* BR-01 (docs 02 §6): chỉ chọn SKU trong danh mục của NCC. Dòng đã lưu (`lineId`)
            giữ SKU — BE `PUT /purchase-orders/{id}` báo 400 nếu đổi. */}
        <SkuCatalogCombobox
          items={catalog.items}
          value={line?.skuId ?? ""}
          usedSkus={usedSkus}
          onSelect={(item) => catalog.selectSku(index, item)}
          ariaLabel={C.skuAria(n)}
          hasError={!!errors?.skuId}
          describedBy={errors?.skuId ? skuErrorId : locked ? lockedId : undefined}
          disabled={locked || !pickable}
        />
        {locked && (
          <p id={lockedId} className="text-ink-tertiary mt-0.5 text-[11px]">
            {C.skuLocked}
          </p>
        )}
        {line?.terms && <LineTermsHint terms={line.terms} poCurrency={currency} />}
        {line?.description && (
          <p className="text-ink-secondary mt-0.5 truncate text-[11px]" title={line.description}>
            {line.description}
          </p>
        )}
        <FieldError id={skuErrorId}>{errors?.skuId?.message}</FieldError>
      </td>
      {numCell("orderedQty", "qty", S.qtyAria(n), { min: 1, inputMode: "numeric" })}
      {numCell("unitPrice", "price", S.priceAria(n), {
        min: 0,
        step: 10 ** -priceDigits,
        inputMode: priceDigits === 0 ? "numeric" : "decimal",
        placeholder: priceRequired ? undefined : C.pricePlaceholder,
      })}
      {numCell("taxRate", "tax", S.taxAria(n), {
        min: 0,
        max: 100,
        step: "0.01",
        inputMode: "decimal",
        placeholder: "0",
      })}
      <td className={cn("text-ink-primary px-2 pt-3.5 align-top text-[0.8125rem]", NUM)}>
        {formatMoney(line ? lineTotal(line, currency) : 0, currency)}
      </td>
      <td className="px-1 py-2 align-top">
        <div className="flex items-center justify-end">
          <PoLineDescriptionPopover w={w} index={index} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={S.removeAria(n)}
            className="text-ink-tertiary hover:bg-danger/10 hover:text-danger size-8 rounded-[var(--r-sm)]"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
