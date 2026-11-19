import { ORDER_DELIVERY_FAILURE_LABELS, UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format/number";

import { MONO } from "../primitives";

import type { Shipment } from "@/features/shipping/types";

const S = UI_LABELS.shipping.shipment.outcomeDialog;
const NONE = UI_LABELS.shipping.none;

/** "4 kiện · 34,4 kg"; thiếu cân nặng của kiện nào thì chỉ nêu số kiện (không đoán tổng). */
export function packageSummary(data: Pick<Shipment, "packages" | "shipment">): string {
  const count = S.packagesCount(data.shipment.packageCount ?? data.packages.length);
  const weights = data.packages.map((parcel) => parcel.weightKg);
  if (weights.length === 0 || weights.some((weight) => weight == null)) return count;
  const total = weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
  return `${count} · ${formatNumber(total)} kg`;
}

/**
 * Bảng tóm tắt lô trong hộp thoại ghi nhận (artboard "Ghi nhận đã giao" / "Ghi nhận hàng hoàn về kho"): đơn, hãng, chuyến,
 * số kiện — để người ghi nhận biết đang xác nhận lô nào. Lấy từ chi tiết lô, không cần dữ liệu mới. Lô đã giao thất bại
 * thì nêu thêm kết quả hiện tại.
 */
export function OutcomeSummary({
  data,
  showCurrent = true,
}: {
  data: Shipment;
  /** Nêu kết quả hiện tại của lô giao thất bại (hộp thoại sửa tự nêu riêng). */
  showCurrent?: boolean;
}) {
  const { shipment } = data;
  const failed = showCurrent && shipment.status === "DELIVERY_FAILED";
  const failureLabel = shipment.failureReason
    ? (ORDER_DELIVERY_FAILURE_LABELS[
        shipment.failureReason as keyof typeof ORDER_DELIVERY_FAILURE_LABELS
      ] ?? shipment.failureReason)
    : null;
  return (
    <dl className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[0.8125rem]">
      {failed && (
        <>
          <dt className="text-ink-tertiary">{S.summary.currentResult}</dt>
          <dd className="text-ink-primary">
            <span className="text-danger font-medium">
              {UI_LABELS.shipping.shipment.correction.toFailed}
            </span>
            {failureLabel && <span className="text-ink-tertiary"> · {failureLabel}</span>}
          </dd>
        </>
      )}
      <dt className="text-ink-tertiary">{S.summary.order}</dt>
      <dd className={`text-ink-primary ${MONO}`}>{shipment.orderNumber ?? shipment.orderId}</dd>
      <dt className="text-ink-tertiary">{S.summary.carrier}</dt>
      <dd className="text-ink-primary">
        {shipment.carrierName ?? UI_LABELS.shipping.field.carrierNone}
      </dd>
      <dt className="text-ink-tertiary">{S.summary.load}</dt>
      <dd className={`text-ink-primary ${MONO}`}>{shipment.loadCode ?? NONE}</dd>
      <dt className="text-ink-tertiary">{S.summary.packages}</dt>
      <dd className={`text-ink-primary ${MONO}`}>{packageSummary(data)}</dd>
    </dl>
  );
}
