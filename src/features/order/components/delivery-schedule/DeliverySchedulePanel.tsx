"use client";

import { DELIVERY_SCHEDULE_LABELS as L, SALES_CONTRACT_PERMISSIONS } from "@/constants";

import { isWindowMovable } from "../../delivery-window-rules";
import { useDeliverySchedule } from "../../queries";

import { DeliveryBatchRow } from "./DeliveryBatchRow";
import { DeliveryWindowAction } from "./DeliveryWindowAction";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

interface DeliverySchedulePanelProps {
  order: Pick<Order, "orderId" | "orderNumber">;
  can: (code: PermissionCode) => boolean;
}

const SECTION =
  "border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]";

/**
 * Lịch giao của đơn (docs 17 §4.5, §5.5): các đợt giao với cửa sổ hiệu lực (kèm cửa sổ hợp đồng + lịch sử khi đã dời),
 * trạng thái từng đợt, thùng theo SKU; Sale dời cửa sổ giao từng đợt (BR-28). Đọc cần `sales-contracts:READ` (quản lý
 * kho không có — seed BE) nên không có quyền thì không gọi API và không hiện panel; đơn không có lịch giao (không hợp đồng
 * ký) cũng không hiện. UI-only — Backend phải re-check (@RequiresPermission READ / UPDATE).
 */
export function DeliverySchedulePanel({ order, can }: DeliverySchedulePanelProps) {
  const canRead = can(SALES_CONTRACT_PERMISSIONS.read);
  const canMove = can(SALES_CONTRACT_PERMISSIONS.update);
  const query = useDeliverySchedule(order.orderId, { enabled: canRead });
  if (!canRead || query.isPending) return null;
  if (query.isError) {
    return (
      <section aria-label={L.title} className={SECTION}>
        <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
        <p className="text-ink-tertiary text-xs">{L.failed}</p>
      </section>
    );
  }
  const { batches, contractNumber } = query.data;
  if (batches.length === 0) return null;
  const ordered = [...batches].sort((a, b) => a.seq - b.seq);
  return (
    <section aria-label={L.title} className={SECTION}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{L.title}</h2>
        {contractNumber && (
          <span className="text-ink-tertiary text-xs">{L.contract(contractNumber)}</span>
        )}
      </div>
      <ul className="divide-border-default divide-y">
        {ordered.map((batch) => {
          const movable = isWindowMovable(batch);
          return (
            <DeliveryBatchRow
              key={batch.batchId}
              batch={batch}
              action={
                canMove && movable ? (
                  <DeliveryWindowAction order={order} batch={batch} batches={ordered} />
                ) : null
              }
              lockedHint={canMove && !movable ? L.lockedHint : null}
            />
          );
        })}
      </ul>
      {!canMove && <p className="text-ink-tertiary mt-3 text-xs">{L.readOnly}</p>}
    </section>
  );
}
