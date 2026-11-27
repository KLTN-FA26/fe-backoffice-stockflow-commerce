import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { formatDecimal } from "@/lib/format/number";
import { Notice } from "@/components/shared/Notice";

import type { ShippingWarehouseOption } from "../../shipping-warehouse-schemas";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.dialog;

const volume = (m3: number | null | undefined) =>
  m3 == null ? null : L.volume(formatDecimal(m3, 3));

/**
 * Hai số docs 17 §4.2 bước 2 đòi hiện cho Sale ở mỗi kho: tồn khả dụng (thùng, ở dòng "Có sẵn x/y thùng") và còn trống
 * dự kiến (m³) — đây là số thứ hai. Không có số (kho không đọc được bảng sức chứa) thì không hiện.
 */
export function ProjectedFree({ option }: { option: ShippingWarehouseOption }) {
  const projected = volume(option.projectedFreeM3);
  if (projected === null) return null;
  return (
    <span className="text-ink-secondary block text-xs tabular-nums">
      {L.projectedFree}: <span className="text-ink-primary">{projected}</span>
    </span>
  );
}

/**
 * Các số còn lại của sức chứa (chờ duyệt, còn trống nếu duyệt hết, cần cho phần phải sản xuất) — để trong "Chi tiết", không
 * chen vào hai số chính (docs 06 §4.6). Số nào BE không tính được (thùng chưa có kích thước) thì không hiện.
 */
export function CapacityDetails({ option }: { option: ShippingWarehouseOption }) {
  const metrics = [
    [L.pending, volume(option.pendingM3)],
    [L.freeIfAllApproved, volume(option.freeIfAllApprovedM3)],
    [L.needed, volume(option.neededM3)],
  ].filter((metric): metric is [string, string] => metric[1] !== null);
  if (metrics.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
      {metrics.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-ink-secondary">{label}</dt>
          <dd className="text-ink-primary tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Cảnh báo sức chứa (BR-25): thể tích phần phải sản xuất vượt chỗ trống chỉ là CẢNH BÁO — kho vẫn chọn được. Luôn hiện,
 * không giấu trong "Chi tiết".
 */
export function CapacityWarnings({ option }: { option: ShippingWarehouseOption }) {
  if (option.exceedsProjected)
    return (
      <Notice tone="warning" live>
        {L.exceedsProjected}
      </Notice>
    );
  if (option.exceedsIfAllApproved)
    return (
      <Notice tone="warning" live>
        {L.exceedsIfAllApproved}
      </Notice>
    );
  return null;
}
