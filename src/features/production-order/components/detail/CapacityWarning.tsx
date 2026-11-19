"use client";

import { PRODUCTION_LABELS } from "@/constants";

import { formatDecimal } from "@/lib/format";

import { hasCapacityWarning } from "@/features/production-order/selectors";

import { Alert } from "@/components/shared/Alert";

import type { ProductionOrder } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.detail;
const m3 = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : formatDecimal(value, 3);

/**
 * BR-25 (docs 17 §6): thể tích Đơn sản xuất vượt còn trống dự kiến, hoặc vượt nếu duyệt hết các đơn đang chờ về cùng kho
 * → cảnh báo, KHÔNG chặn nút nào. Hiện lúc nháp lẫn lúc Sales Manager duyệt (BE tính lại mỗi lần đọc).
 */
export function CapacityWarning({ order }: { order: ProductionOrder }) {
  const capacity = order.capacity;
  if (!capacity || !hasCapacityWarning(order)) return null;
  const code = capacity.board.warehouseCode;
  return (
    <Alert tone="warning" title={L.capacityTitle}>
      <ul className="list-disc space-y-0.5 pl-4">
        {capacity.exceedsProjected && <li>{L.capacityProjected(code)}</li>}
        {capacity.exceedsIfAllApproved && <li>{L.capacityIfAllApproved(code)}</li>}
        {capacity.shortfallM3 !== null && capacity.shortfallM3 !== undefined && (
          <li>{L.capacityShortfall(m3(capacity.shortfallM3))}</li>
        )}
      </ul>
      <p className="mt-1 tabular-nums">
        {L.capacityFigures}: {m3(capacity.neededM3)} / {m3(capacity.board.projectedFreeM3)} /{" "}
        {m3(capacity.board.freeIfAllApprovedM3)} m³
      </p>
      <p className="mt-1">{L.capacityNotBlocking}</p>
    </Alert>
  );
}
