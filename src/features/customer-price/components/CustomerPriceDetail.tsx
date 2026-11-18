"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import { useSkuUnitsPerCarton } from "@/lib/references/sku-carton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { customerPriceErrorMessage } from "../errors";
import { useDeleteCustomerPrice } from "../mutations";

import { tiersAscending } from "../selectors";
import { vnd } from "./price-columns";

import type { CustomerPrice } from "../schemas";

const L = CUSTOMER_PRICE_UI_LABELS;
const D = L.detail;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Bậc giá của một SKU — CHỈ ĐỌC. Mỗi bậc là đơn giá một cái áp dụng từ số thùng (giá cũ `UNIT`: số cái)
 * tối thiểu đó trở lên (BE `CustomerPrice.priceFor`, 13 BR-05), không phải lịch giá theo ngày. Không có nút sửa.
 */
export function CustomerPriceDetail({
  customerId,
  price,
  canDelete = false,
  canSeeCarton = false,
  onClose,
}: {
  customerId: string;
  price: CustomerPrice | null;
  /** `catalog-customer-prices:DELETE` (UI-only, BE re-check). */
  canDelete?: boolean;
  /** `product-variants:READ` + `product-products:READ` — tra số cái / thùng của SKU riêng. */
  canSeeCarton?: boolean;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteCustomerPrice();
  const carton = useSkuUnitsPerCarton(
    customerId,
    price?.sku ?? "",
    canSeeCarton && price !== null && price.measure === "CARTON",
  );
  return (
    <SlideOverPanel
      open={price !== null}
      onClose={onClose}
      title={price?.sku ?? ""}
      monoTitle
      subtitle={L.title}
    >
      {price && (
        <div className="space-y-5 text-[0.8125rem]">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className={NOTE}>{L.field.moq}</dt>
              <dd className="tabular-nums">{formatNumber(price.moq)}</dd>
            </div>
            <div>
              <dt className={NOTE}>{D.version}</dt>
              <dd className="tabular-nums">{price.version}</dd>
            </div>
            <div>
              <dt className={NOTE}>{D.measure}</dt>
              <dd>{L.measure[price.measure]}</dd>
            </div>
            {canSeeCarton && price.measure === "CARTON" && !carton.isPending && (
              <div>
                <dt className={NOTE}>{D.unitsPerCarton}</dt>
                <dd className="tabular-nums">
                  {carton.unitsPerCarton === null
                    ? D.noCarton
                    : D.unitsPerCartonValue(formatNumber(carton.unitsPerCarton))}
                </dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className={NOTE}>{L.field.note}</dt>
              <dd>{price.note ?? D.noNote}</dd>
            </div>
          </dl>
          <section aria-label={D.tierHeading}>
            <h3 className="mb-1 text-sm font-semibold">{D.tierHeading}</h3>
            <p className={`${NOTE} mb-2`}>{D.tierHint}</p>
            <ol className="divide-y divide-[var(--table-line)]">
              {tiersAscending(price).map((tier) => (
                <li
                  key={tier.minQuantity}
                  className="flex items-baseline justify-between gap-3 py-1.5"
                >
                  <span>{D.tierLine(formatNumber(tier.minQuantity), price.measure)}</span>
                  <span className="text-right tabular-nums">
                    {vnd(tier.unitPrice)} {D.perUnit}
                    {!tier.unitPriceExact && (
                      <span role="note" className="text-warning block text-xs">
                        {L.priceInexact}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className={`${NOTE} mt-2`}>{L.moqHint}</p>
            <p className={NOTE}>{L.noValidity}</p>
            {price.measure === "UNIT" && <p className={NOTE}>{L.legacyUnitHint}</p>}
          </section>
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-danger"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              <Trash2 className="size-3.5" /> {L.remove.action}
            </Button>
          )}
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={L.remove.title(price.sku)}
            description={L.remove.description}
            confirmLabel={L.remove.confirm}
            variant="danger"
            loading={remove.isPending}
            closeOnConfirm={false}
            error={error}
            onConfirm={() =>
              remove.mutate(
                { customerId, sku: price.sku, version: price.version },
                {
                  onSuccess: () => {
                    toast.success(L.remove.deleted);
                    setConfirming(false);
                    onClose();
                  },
                  onError: (e) => setError(customerPriceErrorMessage(e)),
                },
              )
            }
          />
        </div>
      )}
    </SlideOverPanel>
  );
}
