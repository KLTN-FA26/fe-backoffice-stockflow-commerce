"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";

import { tiersAscending } from "../selectors";
import { vnd } from "./price-columns";

import type { CustomerPrice } from "../schemas";

const L = CUSTOMER_PRICE_UI_LABELS;
const D = L.detail;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Bậc giá của một SKU — CHỈ ĐỌC. Mỗi bậc là đơn giá áp dụng từ số lượng tối thiểu đó trở lên (BE
 * `CustomerPrice.priceFor`), không phải lịch giá theo ngày (không có ngày hiệu lực). Không có nút sửa.
 */
export function CustomerPriceDetail({
  price,
  onClose,
}: {
  price: CustomerPrice | null;
  onClose: () => void;
}) {
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
                  <span>{D.tierLine(formatNumber(tier.minQuantity))}</span>
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
          </section>
        </div>
      )}
    </SlideOverPanel>
  );
}
