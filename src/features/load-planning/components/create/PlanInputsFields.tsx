"use client";

import { LOAD_PLAN_SOURCE, UI_LABELS } from "@/constants";
import { knownLoadPlanReadError } from "@/features/load-planning/errors";

import { ModePicker } from "./ModePicker";
import { ShipmentPicker } from "./ShipmentPicker";
import { TransferFixed } from "./TransferFixed";
import { TransferPicker } from "./TransferPicker";
import { VehicleTypePicker } from "./VehicleTypePicker";

import type { UseQueryResult } from "@tanstack/react-query";
import type {
  CandidateShipment,
  TransferInPlan,
  VehicleTypeOption,
} from "@/features/load-planning/plan-types";
import type { PlanInputsState } from "./usePlanInputsState";

const L = UI_LABELS.loadPlan.createForm;
const T = UI_LABELS.loadPlan.transfer;

/**
 * Các khối đầu vào kế hoạch dùng ở màn lập mới và hộp thoại đổi đầu vào: lô giao (hoặc, ở kế hoạch cũ còn nguồn TRANSFER,
 * lệnh chuyển kho — không còn lập mới được vì BE bỏ lệnh chuyển kho), loại xe, chế độ. Hộp thoại đổi đầu vào của kế hoạch TRANSFER truyền `fixedTransfer`: lệnh cố định,
 * chỉ đổi loại xe / chế độ.
 */
export function PlanInputsFields({
  idPrefix,
  warehouseId,
  candidates,
  transferCandidates,
  fixedTransfer,
  preselectedGone = false,
  types,
  inputs,
}: {
  idPrefix: string;
  warehouseId: string;
  /** Lô ứng viên của kho (cha gọi query để còn lọc lô đã mất khi gửi). */
  candidates: UseQueryResult<CandidateShipment[]>;
  /** Lệnh chuyển kho ứng viên (nguồn TRANSFER). */
  transferCandidates?: UseQueryResult<CandidateShipment[]>;
  fixedTransfer?: TransferInPlan | null;
  preselectedGone?: boolean;
  types: UseQueryResult<VehicleTypeOption[]>;
  inputs: PlanInputsState;
}) {
  const transfer = inputs.sourceType === LOAD_PLAN_SOURCE.TRANSFER;
  return (
    <div className="space-y-5">
      {transfer ? (
        <section aria-labelledby={`${idPrefix}-transfers`} className="space-y-2">
          <h3 id={`${idPrefix}-transfers`} className="text-ink-primary text-sm font-medium">
            {T.transfersTitle}
          </h3>
          <p className="text-ink-tertiary text-xs">{T.transfersHint}</p>
          {fixedTransfer ? (
            <TransferFixed transfer={fixedTransfer} />
          ) : (
            <TransferPicker
              name={`${idPrefix}-transfer-radio`}
              warehouseId={warehouseId}
              candidates={transferCandidates?.data}
              loading={!!warehouseId && !!transferCandidates?.isPending}
              failed={
                transferCandidates?.isError
                  ? (knownLoadPlanReadError(transferCandidates.error) ?? T.candidatesFailed)
                  : null
              }
              selectedId={inputs.transferId}
              onSelect={inputs.setTransferId}
              preselectedGone={preselectedGone}
            />
          )}
        </section>
      ) : (
        <section aria-labelledby={`${idPrefix}-shipments`} className="space-y-2">
          <h3 id={`${idPrefix}-shipments`} className="text-ink-primary text-sm font-medium">
            {L.shipmentsTitle}
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
      )}
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
