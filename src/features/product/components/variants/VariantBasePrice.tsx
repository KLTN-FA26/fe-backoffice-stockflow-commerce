"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { listingErrorMessage } from "../../listing-errors";
import { useRefreshOnConflict, useSaveSkuPrice, useSkuPrice } from "../../listing-queries";
import { basePriceFormSchema } from "../../listing-schemas";
import { formatVnd } from "../../selectors";
import { Field } from "./Field";

import type { SkuPrice } from "../../listing-schemas";

/**
 * Giá bán cơ sở của SKU (BE `GET/PUT /products/{id}/skus/{sku}/base-price`, theo MÃ SKU): VND số
 * nguyên, khoá lạc quan bằng `revision` của listing. Phải lưu thông tin cửa hàng của sản phẩm trước.
 * Giá hiệu lực có thể khác giá cơ sở khi có quy tắc giá khác (BE quyết định). Backend phải re-check.
 */
export function VariantBasePrice({
  productId,
  sku,
  canEdit,
}: {
  productId: string;
  sku: string;
  canEdit: boolean;
}) {
  const query = useSkuPrice(productId, sku);
  const [editing, setEditing] = useState(false);

  if (query.isLoading) return <p className="text-ink-tertiary text-xs">Đang tải giá…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-danger text-xs">
        {listingErrorMessage(query.error)}
      </p>
    );
  }
  const price = query.data;
  if (editing) {
    return <PriceForm productId={productId} price={price} onDone={() => setEditing(false)} />;
  }
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <div>
          <dt className="text-ink-tertiary text-xs">Giá bán cơ sở</dt>
          <dd className="tabular-nums">
            {price.basePrice == null ? "Chưa có giá" : formatVnd(price.basePrice)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-tertiary text-xs">Giá hiệu lực</dt>
          <dd className="tabular-nums">
            {price.effectivePrice == null ? "—" : formatVnd(price.effectivePrice)}
          </dd>
        </div>
      </dl>
      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> {price.basePrice == null ? "Đặt giá" : "Sửa giá"}
        </Button>
      )}
    </div>
  );
}

function PriceForm({
  productId,
  price,
  onDone,
}: {
  productId: string;
  price: SkuPrice;
  onDone: () => void;
}) {
  const [value, setValue] = useState(price.basePrice == null ? "" : String(price.basePrice));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSkuPrice();
  const refreshOnConflict = useRefreshOnConflict();
  const parsed = basePriceFormSchema.safeParse({ price: value });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!parsed.success) return;
        setError(null);
        save.mutate(
          { productId, sku: price.sku, revision: price.revision, price: Number(parsed.data.price) },
          {
            onSuccess: onDone,
            onError: (err) => {
              setError(listingErrorMessage(err));
              refreshOnConflict(err);
            },
          },
        );
      }}
    >
      <Field
        label="Giá bán cơ sở (VND) *"
        id="base-price"
        error={value && !parsed.success ? parsed.error.issues[0]?.message : undefined}
      >
        <Input
          id="base-price"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-right tabular-nums"
          autoFocus
        />
      </Field>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" size="sm" disabled={!parsed.success || save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu giá"}
        </Button>
      </div>
    </form>
  );
}
