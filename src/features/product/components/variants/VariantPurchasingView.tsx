"use client";

import { Pencil } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDecimalMoney, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

import { DefaultSupplierValue, SupplierTerms } from "./VariantPurchasingSupplier";

import type { SkuPurchasing } from "../../purchasing-schemas";
import type { SupplierLookup } from "./VariantPurchasingSupplier";

const L = UI_LABELS.skuPurchasing;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Thông tin mua hàng chỉ đọc: thiết lập tham chiếu của SKU, tách khỏi điều khoản thật của NCC mặc định
 * (chỉ hiện khi tra được NCC). Nút "Sửa" chỉ khi `onEdit` có (panel đã xét quyền + trạng thái).
 */
export function VariantPurchasingView({
  data,
  lookup,
  onEdit,
}: {
  data: SkuPurchasing;
  lookup: SupplierLookup;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-4">
      <section aria-label={L.referenceTitle}>
        <h4 className="text-ink-secondary mb-1 text-xs font-semibold">{L.referenceTitle}</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
          <div className="col-span-2">
            <dt className={NOTE}>{L.field.defaultSupplier}</dt>
            <dd>
              <DefaultSupplierValue supplierId={data.defaultSupplierId} lookup={lookup} />
            </dd>
          </div>
          <Item label={L.field.referencePrice} value={priceText(data)} />
          <Item
            label={L.field.leadTimeDays}
            value={data.leadTimeDays === null ? L.notSet : L.days(data.leadTimeDays)}
          />
          <Item label={L.field.moq} value={data.moq === null ? L.notSet : formatNumber(data.moq)} />
        </dl>
        <p className={`${NOTE} mt-1`}>{L.referenceHint}</p>
      </section>
      {lookup.kind === "found" && <SupplierTerms row={lookup.row} />}
      {onEdit && (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" /> {L.edit}
        </Button>
      )}
    </div>
  );
}

/** Giá là chuỗi thập phân chính xác (không qua số thực); BE trả giá và tiền tệ cùng có / cùng trống. */
function priceText(data: SkuPurchasing): string {
  const { referencePurchasePrice: price, referencePurchaseCurrency: currency } = data;
  if (price === null || currency === null) return L.notSet;
  return formatDecimalMoney(price, currency);
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={NOTE}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
