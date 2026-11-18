"use client";

import { CATALOG_CUSTOMER_PRICE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";
import { useCustomerOwnPrice } from "@/lib/references/price-schedule";
import { tierPrice } from "@/features/quote/selectors";
import { Notice } from "@/components/shared/Notice";

const VND = "VND";

/**
 * Xem trước giá riêng của khách cho SKU — CHỈ tạm tính; BE chọn bậc và tính tiền khi lưu. Giá riêng là nguồn
 * duy nhất (kltn-docs 13 BR-04, D14). Giá theo thùng (`CARTON`, 13 BR-05): bậc theo số thùng nên ở đây chỉ
 * liệt kê bậc; giá cũ theo cái (`UNIT`): tra bậc theo tổng số cái như trước (P5). Chưa có giá → Sales nhập.
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
  const price = useCustomerOwnPrice(customerId, blankSku, canReadPrices && useListPrice);
  if (!useListPrice || !blankSku) return null;
  if (!canReadPrices)
    return (
      <p className="text-ink-tertiary text-xs">
        Bạn chưa có quyền xem bảng giá; BE sẽ áp giá khi lưu.
      </p>
    );
  if (price.isPending) return <p className="text-ink-tertiary text-xs">Đang tra giá riêng…</p>;
  if (price.isError) return <Notice tone="warning">Không tra được giá riêng của khách.</Notice>;
  if (price.data === null)
    return (
      <Notice tone="warning">
        Khách chưa có giá riêng cho SKU này — bỏ chọn “Theo bảng giá” và nhập bậc giá thoả thuận.
      </Notice>
    );
  const data = price.data;
  const byCarton = data.measure === "CARTON";
  const per = byCarton ? "thùng" : "cái";
  const unit = byCarton ? null : tierPrice(data.tiers, blankUnits);
  return (
    <div className="text-ink-secondary space-y-0.5 text-xs">
      <div>
        Giá riêng của khách · MOQ {formatNumber(data.moq)} {per} ·{" "}
        {data.tiers
          .map(
            (tier) =>
              `từ ${formatNumber(tier.minQuantity)} ${per}: ${formatMoney(tier.unitPrice, VND)}/cái`,
          )
          .join(" · ")}
      </div>
      {byCarton ? (
        <div>Bậc tính theo số thùng — BE chọn bậc khi lưu.</div>
      ) : unit === null ? (
        <Notice tone="warning">
          Tổng {formatNumber(blankUnits)} cái dưới bậc thấp nhất — nhập bậc giá thoả thuận (P4).
        </Notice>
      ) : (
        <div>
          Tạm tính theo tổng {formatNumber(blankUnits)} cái:{" "}
          <span className="tabular-nums">{formatMoney(unit, VND)}</span> / cái
        </div>
      )}
    </div>
  );
}
