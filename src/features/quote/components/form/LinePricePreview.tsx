"use client";

import { CATALOG_CUSTOMER_PRICE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";
import { PRICE_SOURCE_LABEL, useCustomerPriceSchedule } from "@/lib/references/price-schedule";
import { tierPrice } from "@/features/quote/selectors";
import { Notice } from "@/components/shared/Notice";

/**
 * Xem trước giá theo bảng giá khách — CHỈ tạm tính; BE chọn bậc và tính tiền khi lưu.
 * P5: tra bậc theo TỔNG số cái của cùng mã phôi trên báo giá. P4: dưới bậc thấp nhất →
 * không áp giá bậc thấp nhất, Sales nhập bậc thoả thuận.
 */
export function LinePricePreview({
  customerId,
  blankSku,
  blankUnits,
  useListPrice,
}: {
  customerId: string;
  blankSku: string;
  blankUnits: number;
  useListPrice: boolean;
}) {
  const canReadPrices = useCan(CATALOG_CUSTOMER_PRICE_PERMISSIONS.read);
  const schedule = useCustomerPriceSchedule(customerId, blankSku, canReadPrices && useListPrice);
  if (!useListPrice || !blankSku) return null;
  if (!canReadPrices)
    return (
      <p className="text-ink-tertiary text-xs">
        Bạn chưa có quyền xem bảng giá; BE sẽ áp giá khi lưu.
      </p>
    );
  if (schedule.isPending) return <p className="text-ink-tertiary text-xs">Đang tra bảng giá…</p>;
  if (schedule.isError) return <Notice tone="warning">Không tra được bảng giá.</Notice>;
  if (schedule.data === null)
    return (
      <Notice tone="warning">
        Phôi chưa có giá bán cho khách này — bỏ chọn “Theo bảng giá” và nhập bậc giá thoả thuận.
      </Notice>
    );
  const data = schedule.data;
  const unit = tierPrice(data.tiers, blankUnits);
  return (
    <div className="text-ink-secondary space-y-0.5 text-xs">
      <div>
        {PRICE_SOURCE_LABEL[data.source]} · MOQ {formatNumber(data.moq)} ·{" "}
        {data.tiers
          .map(
            (tier) =>
              `≥${formatNumber(tier.minQuantity)}: ${formatMoney(tier.unitPrice, data.currency)}`,
          )
          .join(" · ")}
      </div>
      {unit === null ? (
        <Notice tone="warning">
          Tổng {formatNumber(blankUnits)} cái của phôi này dưới bậc thấp nhất — nhập bậc giá thoả
          thuận (P4).
        </Notice>
      ) : (
        <div>
          Tạm tính theo tổng {formatNumber(blankUnits)} cái:{" "}
          <span className="tabular-nums">{formatMoney(unit, data.currency)}</span> / cái
        </div>
      )}
    </div>
  );
}
