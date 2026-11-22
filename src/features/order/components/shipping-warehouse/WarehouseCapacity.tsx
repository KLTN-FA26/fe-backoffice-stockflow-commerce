import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { formatDecimal } from "@/lib/format/number";
import { Notice } from "@/components/shared/Notice";

import type { ShippingWarehouseOption } from "../../shipping-warehouse-schemas";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.dialog;

const volume = (m3: number | null | undefined) =>
  m3 == null ? null : L.volume(formatDecimal(m3, 3));

/**
 * Sức chứa của một kho (docs 17 §4.2 bước 2, BR-25; 06 §4.6): còn trống dự kiến, chờ duyệt, còn trống nếu duyệt hết và thể
 * tích phần phải sản xuất tại đây. Thể tích vượt chỗ trống chỉ là CẢNH BÁO — kho vẫn chọn được. Số nào BE không tính được
 * (kho không đọc được bảng sức chứa, thùng chưa có kích thước) thì không hiện.
 */
export function WarehouseCapacity({ option }: { option: ShippingWarehouseOption }) {
  const metrics = [
    [L.projectedFree, volume(option.projectedFreeM3)],
    [L.pending, volume(option.pendingM3)],
    [L.freeIfAllApproved, volume(option.freeIfAllApprovedM3)],
    [L.needed, volume(option.neededM3)],
  ].filter((metric): metric is [string, string] => metric[1] !== null);
  if (metrics.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-ink-secondary">{label}</dt>
            <dd className="text-ink-primary tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {option.exceedsProjected && (
        <Notice tone="warning" live>
          {L.exceedsProjected}
        </Notice>
      )}
      {!option.exceedsProjected && option.exceedsIfAllApproved && (
        <Notice tone="warning" live>
          {L.exceedsIfAllApproved}
        </Notice>
      )}
    </div>
  );
}
