"use client";

import { LOAD_PLAN_SELECTION_MODE, UI_LABELS } from "@/constants";
import { knownLoadPlanReadError } from "@/features/load-planning/errors";
import { fillLineOptions, totalsOf } from "@/features/load-planning/plan-selectors";

import { FillLinesPicker } from "./FillLinesPicker";
import { ModePicker } from "./ModePicker";
import { ShipmentPicker } from "./ShipmentPicker";
import { VehicleTypePicker } from "./VehicleTypePicker";

import type { UseQueryResult } from "@tanstack/react-query";
import type { CandidateShipment, VehicleTypeOption } from "@/features/load-planning/plan-types";
import type { PlanInputsState } from "./usePlanInputsState";

const L = UI_LABELS.loadPlan.createForm;

/** Các khối đầu vào kế hoạch dùng ở màn lập mới và hộp thoại đổi đầu vào: lô giao, loại xe, chế độ. */
export function PlanInputsFields({
  idPrefix,
  warehouseId,
  candidates,
  types,
  inputs,
  recommendedCodes,
}: {
  idPrefix: string;
  warehouseId: string;
  /** Lô ứng viên của kho (cha gọi query để còn lọc lô đã mất khi gửi). */
  candidates: UseQueryResult<CandidateShipment[]>;
  types: UseQueryResult<VehicleTypeOption[]>;
  inputs: PlanInputsState;
  /** Mã loại xe mà ước tính tải của các đơn đã chọn dùng (chỉ màn lập mới có) — hiện "Gợi ý". */
  recommendedCodes?: ReadonlySet<string>;
}) {
  const { weightKg, volumeMm3 } = totalsOf(candidates.data ?? [], inputs.shipments);
  const hasRecommendation = (recommendedCodes?.size ?? 0) > 0;
  return (
    <div className="space-y-5">
      <section aria-labelledby={`${idPrefix}-shipments`} className="space-y-2">
        <h3 id={`${idPrefix}-shipments`} className="text-ink-primary text-sm font-medium">
          {L.shipmentsTitle} <span className="text-danger">*</span>
        </h3>
        <p className="text-ink-tertiary text-xs">{L.shipmentsHint}</p>
        <ShipmentPicker
          warehouseId={warehouseId}
          candidates={candidates.data}
          loading={!!warehouseId && candidates.isPending}
          failed={
            candidates.isError
              ? (knownLoadPlanReadError(candidates.error) ?? L.candidatesFailed)
              : null
          }
          selected={inputs.shipments}
          onToggle={inputs.toggleShipment}
          onSetAll={inputs.setShipments}
        />
      </section>
      <section aria-labelledby={`${idPrefix}-types`} className="space-y-2">
        <h3 id={`${idPrefix}-types`} className="text-ink-primary text-sm font-medium">
          {L.vehicleTypesTitle} <span className="text-danger">*</span>
        </h3>
        <p className="text-ink-tertiary text-xs">
          {hasRecommendation ? L.vehicleTypesHintEstimated : L.vehicleTypesHint}
        </p>
        <VehicleTypePicker
          types={types.data}
          loading={types.isPending}
          failed={types.isError}
          selected={inputs.vehicleTypes}
          onToggle={inputs.toggleVehicleType}
          load={{ weightKg, volumeMm3 }}
          recommendedCodes={recommendedCodes}
        />
      </section>
      <section aria-labelledby={`${idPrefix}-mode`} className="space-y-2">
        <h3 id={`${idPrefix}-mode`} className="text-ink-primary text-sm font-medium">
          {L.modeTitle}
        </h3>
        <ModePicker name={`${idPrefix}-mode-radio`} value={inputs.mode} onChange={inputs.setMode} />
        {inputs.mode === LOAD_PLAN_SELECTION_MODE.PRIORITY_FILL && (
          <FillLinesPicker
            idPrefix={idPrefix}
            options={fillLineOptions(candidates.data ?? [], inputs.shipments).map((o) => ({
              orderLineId: o.orderLineId,
              label: L.fillLine(o.shipmentCode, o.sku, o.packages),
              ariaLabel: L.fillAria(o.shipmentCode, o.sku),
            }))}
            ticked={inputs.fillLines}
            onToggle={inputs.toggleFillLine}
          />
        )}
      </section>
    </div>
  );
}
