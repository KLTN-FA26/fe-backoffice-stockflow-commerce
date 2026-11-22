"use client";

import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Loader2, Route } from "lucide-react";

import { PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { useOpenTrip } from "@/features/putaway/trip-mutations";

import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { PutawayWarehouseSelect } from "../PutawayWarehouseSelect";
import { tripCallbacks } from "./useTripAction";

const L = PUTAWAY_TRIP_LABELS.start;
/** Nút chính cao bằng ô chọn kho bên cạnh (40px) — `DETAIL_ACTION_CLASS` 34px sẽ lệch hàng. */
const OPEN_BUTTON_CLASS =
  "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse h-(--control-h) rounded-(--action-radius) border px-4 text-[0.8125rem] font-medium";

/**
 * Chưa có chuyến mở: chọn kho rồi mở chuyến (LOADING). Kho lấy từ `?warehouse=` (nút trên danh sách cất hàng truyền
 * sang) hoặc tự chọn khi chỉ thấy một kho.
 */
export function TripStart({ onStale }: { onStale: () => void }) {
  const canOpen = useCan(PUTAWAY_TRIP_PERMISSIONS.update);
  const { data: warehouses = [] } = useWarehouseDirectory();
  const [param, setParam] = useQueryState("warehouse", parseAsString);
  const warehouseId =
    param ?? (warehouses.length === 1 ? (warehouses[0]?.warehouseId ?? null) : null);
  const open = useOpenTrip();
  const [attempt] = useState(() => createIdempotencyAttempt());
  return (
    <section className={`${DETAIL_CARD_CLASS} mx-auto max-w-lg`} aria-labelledby="trip-start-title">
      <DetailCardTitle icon={Route}>
        <span id="trip-start-title">{L.title}</span>
      </DetailCardTitle>
      <p className="text-ink-secondary mb-4 text-[0.8125rem]">{L.description}</p>
      {canOpen ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <PutawayWarehouseSelect
            value={warehouseId}
            warehouses={warehouses}
            onChange={(id) => void setParam(id)}
            widthClass="w-full"
          />
          <Button
            type="button"
            disabled={!warehouseId || open.isPending}
            onClick={() =>
              warehouseId &&
              open.mutate(
                { warehouseId, idempotencyKey: attempt.keyFor({ warehouseId }) },
                tripCallbacks(onStale, () => attempt.reset()),
              )
            }
            className={OPEN_BUTTON_CLASS}
          >
            {open.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {L.submit}
          </Button>
          {!warehouseId && (
            <p className="text-ink-tertiary col-span-2 text-xs">{L.chooseWarehouse}</p>
          )}
        </div>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noPermission}</p>
      )}
    </section>
  );
}
