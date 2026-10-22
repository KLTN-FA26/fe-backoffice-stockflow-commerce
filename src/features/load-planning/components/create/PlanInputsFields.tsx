"use client";

import { UI_LABELS } from "@/constants";

import { ModePicker } from "./ModePicker";
import { ShipmentPicker } from "./ShipmentPicker";
import { VehicleTypePicker } from "./VehicleTypePicker";

import type { UseQueryResult } from "@tanstack/react-query";
import type { CandidateShipment, VehicleTypeOption } from "@/features/load-planning/plan-types";
import type { PlanInputsState } from "./usePlanInputsState";

const L = UI_LABELS.loadPlan.createForm;

/** Ba khối đầu vào kế hoạch (lô, loại xe, chế độ) dùng ở màn lập mới và hộp thoại đổi đầu vào. */
export function PlanInputsFields({
  idPrefix,
  warehouseId,
  candidates,
  types,
  inputs,
}: {
  idPrefix: string;
  warehouseId: string;
  /** Lô ứng viên của kho (cha gọi query để còn lọc lô đã mất khi gửi). */
  candidates: UseQueryResult<CandidateShipment[]>;
  types: UseQueryResult<VehicleTypeOption[]>;
  inputs: PlanInputsState;
}) {
  return (
    <div className="space-y-5">
      <section aria-labelledby={`${idPrefix}-shipments`} className="space-y-2">
        <h3 id={`${idPrefix}-shipments`} className="text-ink-primary text-sm font-medium">
          {L.shipmentsTitle}
        </h3>
        <p className="text-ink-tertiary text-xs">{L.shipmentsHint}</p>
        <ShipmentPicker
          warehouseId={warehouseId}
          candidates={candidates.data}
          loading={!!warehouseId && candidates.isPending}
          failed={candidates.isError}
          selected={inputs.shipments}
          onToggle={inputs.toggleShipment}
          onSetAll={inputs.setShipments}
        />
      </section>
      <section aria-labelledby={`${idPrefix}-types`} className="space-y-2">
        <h3 id={`${idPrefix}-types`} className="text-ink-primary text-sm font-medium">
          {L.vehicleTypesTitle}
        </h3>
        <p className="text-ink-tertiary text-xs">{L.vehicleTypesHint}</p>
        <VehicleTypePicker
          types={types.data}
          loading={types.isPending}
          failed={types.isError}
          selected={inputs.vehicleTypes}
          onToggle={inputs.toggleVehicleType}
        />
      </section>
      <section aria-labelledby={`${idPrefix}-mode`} className="space-y-2">
        <h3 id={`${idPrefix}-mode`} className="text-ink-primary text-sm font-medium">
          {L.modeTitle}
        </h3>
        <ModePicker name={`${idPrefix}-mode-radio`} value={inputs.mode} onChange={inputs.setMode} />
      </section>
    </div>
  );
}
