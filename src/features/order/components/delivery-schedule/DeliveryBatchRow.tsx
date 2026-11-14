import { DELIVERY_SCHEDULE_LABELS as L } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { formatWindowRange, isWindowMoved } from "../../delivery-window-rules";

import { DeliveryBatchStateBadge } from "./DeliveryBatchStateBadge";
import { WindowChangeHistory } from "./WindowChangeHistory";

import type { ReactNode } from "react";
import type { DeliveryBatch } from "../../delivery-batch-api";

const CHIP = "rounded-[var(--r-sm)] px-1.5 py-0.5 text-xs font-medium";

/**
 * Một đợt giao (docs 17 §4.5, §5.5): trạng thái hiển thị do hệ thống tính, cửa sổ giao HIỆU LỰC (kèm cửa sổ hợp đồng khi
 * đã dời), cờ trễ, thùng theo SKU (đã giữ / cần), lịch sử dời. `action` là nút "Dời cửa sổ giao" do panel quyết (gate
 * theo quyền + trạng thái).
 */
export function DeliveryBatchRow({
  batch,
  action,
  lockedHint,
}: {
  batch: DeliveryBatch;
  action: ReactNode;
  /** Lý do không dời được (đã bàn giao…), chỉ truyền cho người có quyền dời. */
  lockedHint: string | null;
}) {
  const moved = isWindowMoved(batch);
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink-primary text-[0.8125rem] font-semibold">{L.batch(batch.seq)}</h3>
        <DeliveryBatchStateBadge state={batch.state} />
        {batch.late && (
          <span
            title={L.lateHint}
            className={`${CHIP} text-danger bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]`}
          >
            {L.late}
          </span>
        )}
        {moved && <span className={`${CHIP} bg-bg-muted text-ink-secondary`}>{L.moved}</span>}
        <span className="ml-auto">{action}</span>
      </div>
      <div className="text-[0.8125rem]">
        <span className="text-ink-tertiary">{L.window}: </span>
        <span className="text-ink-primary tabular-nums">
          {formatWindowRange(batch.windowStart, batch.windowEnd)}
        </span>
        {moved && (
          <span className="text-ink-tertiary block text-xs tabular-nums">
            {L.contractWindow(
              formatWindowRange(batch.contractWindowStart, batch.contractWindowEnd),
            )}
          </span>
        )}
        <span className="text-ink-tertiary block text-xs tabular-nums">
          {batch.releasedAt ? L.released(formatDateTime(batch.releasedAt)) : L.notReleased}
        </span>
      </div>
      {batch.lines.length > 0 ? (
        <ul aria-label={L.cartonsHeader} className="text-ink-secondary space-y-0.5 text-xs">
          {batch.lines.map((line) => (
            <li key={line.orderLineId} className="flex justify-between gap-3">
              <span className="font-[family-name:var(--font-mono)]">{line.sku ?? "—"}</span>
              <span className="tabular-nums">{L.cartons(line.heldCartons, line.cartons)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-tertiary text-xs">{L.noLines}</p>
      )}
      {lockedHint && <p className="text-ink-tertiary text-xs">{lockedHint}</p>}
      <WindowChangeHistory changes={batch.windowChanges} />
    </li>
  );
}
