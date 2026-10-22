"use client";

import { UI_LABELS } from "@/constants";
import { knownLoadPlanReadError } from "@/features/load-planning/errors";

import { ModePicker } from "./ModePicker";
import { ShipmentPicker } from "./ShipmentPicker";
import { SourcePicker } from "./SourcePicker";
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
 * Các khối đầu vào kế hoạch dùng ở màn lập mới và hộp thoại đổi đầu vào: nguồn (chỉ khi lập mới), lô giao HOẶC lệnh chuyển
 * kho (BE PR #164), loại xe, chế độ. Hộp thoại đổi đầu vào của kế hoạch TRANSFER truyền `fixedTransfer`: lệnh cố định,
 * chỉ đổi loại xe / chế độ.
 */
export function PlanInputsFields({
  idPrefix,
  warehouseId,
  candidates,
  transferCandidates,
  fixedTransfer,
  preselectedGone = false,
  showSource = false,
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
  /** Hiện công tắc nguồn (chỉ màn lập mới; kế hoạch đã có nguồn cố định). */
  showSource?: boolean;
  types: UseQueryResult<VehicleTypeOption[]>;
  inputs: PlanInputsState;
}) {
  const transfer = inputs.sourceType === "TRANSFER";
  return (
    <div className="space-y-5">
      {showSource && (
        <section aria-labelledby={`${idPrefix}-source`} className="space-y-2">
          <h3 id={`${idPrefix}-source`} className="text-ink-primary text-sm font-medium">
            {T.sourceTitle}
          </h3>
          <p className="text-ink-tertiary text-xs">{T.sourceHint}</p>
          <SourcePicker
            name={`${idPrefix}-source-radio`}
            value={inputs.sourceType}
            onChange={inputs.setSourceType}
          />
        </section>
      )}
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
