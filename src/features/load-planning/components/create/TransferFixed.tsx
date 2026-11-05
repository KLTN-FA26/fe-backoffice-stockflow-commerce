"use client";

import { UI_LABELS } from "@/constants";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import type { TransferInPlan } from "@/features/load-planning/plan-types";

const T = UI_LABELS.loadPlan.transfer;

/** Lệnh chuyển kho cố định của kế hoạch nguồn TRANSFER (hộp thoại đổi đầu vào): chỉ xem, không đổi lệnh. */
export function TransferFixed({ transfer }: { transfer: TransferInPlan }) {
  const warehouses = useWarehouseDirectory().data;
  const to = warehouses?.find((w) => w.warehouseId === transfer.toWarehouseId);
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <p>
        <span className="text-ink-primary font-mono font-medium">{transfer.number}</span>
        <span className="text-ink-secondary ml-3">
          {T.toWarehouse}: {to ? to.name : "—"} · {T.detail.packageCount}: {transfer.packageCount}
        </span>
      </p>
      <p className="text-ink-tertiary mt-1 text-xs">{T.detail.editInputsFixed}</p>
    </div>
  );
}
