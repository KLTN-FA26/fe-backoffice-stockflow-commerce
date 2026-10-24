"use client";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { UnplacedTable } from "./UnplacedTable";

import type { PlanParcel } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.detail;
const U = L.unplaced;

/** Câu đầu khay: lệnh chuyển kho đi nguyên (không có "để lại") / đã xác nhận để lại / còn cần xác nhận (BR-13). */
const trayNotice = (shipsWhole: boolean, acknowledged: boolean): string =>
  shipsWhole
    ? UI_LABELS.loadPlan.transfer.detail.shipsWhole
    : acknowledged
      ? U.acknowledged
      : U.pending;

interface UnplacedTrayProps {
  parcels: readonly PlanParcel[];
  acknowledged: boolean;
  /** Được tính lại xe (`:UPDATE`, kế hoạch PLANNED): hiện ô chọn kiện và nút "đưa lại vào xe". */
  canReturn: boolean;
  /** Được xác nhận để lại các kiện này: hiện nút ngay trong khay. */
  canAcknowledge: boolean;
  /** Kế hoạch nguồn TRANSFER: lệnh chuyển kho đi nguyên, không có "để lại" — thay câu xác nhận bằng lời nhắc xếp đủ. */
  shipsWhole?: boolean;
  /** Xe đang xem — nơi các kiện đã chọn được đưa lại vào. */
  vehicleSeq: number | null;
  selected: ReadonlySet<string>;
  pending: boolean;
  onToggle: (packageId: string) => void;
  onReturn: () => void;
  onAcknowledge: () => void;
}

/**
 * Khay kiện chưa xếp: mỗi kiện kèm lý do bằng tiếng Việt (TOO_LARGE, TOO_HEAVY, NO_VEHICLE_AVAILABLE, NO_SPACE,
 * SEARCH_CUT_OFF, MANUAL), trạng thái xác nhận để lại (BR-13), và "đưa lại vào xe" — tính lại riêng xe đang xem kèm
 * các kiện đã chọn (kiện của một bộ kéo theo cả bộ ở BE).
 */
export function UnplacedTray({
  parcels,
  acknowledged,
  canReturn,
  canAcknowledge,
  shipsWhole = false,
  vehicleSeq,
  selected,
  pending,
  onToggle,
  onReturn,
  onAcknowledge,
}: UnplacedTrayProps) {
  if (parcels.length === 0)
    return (
      <section aria-label={U.title}>
        <h3 className="text-ink-primary mb-1 text-sm font-medium">{U.title}</h3>
        <p className="text-ink-tertiary text-sm">{U.empty}</p>
      </section>
    );
  const returnable = canReturn && vehicleSeq !== null;
  const hasKit = parcels.some((parcel) => selected.has(parcel.packageId) && parcel.kitGroupId);
  return (
    <section aria-label={U.title} className="space-y-3">
      <h3 className="text-ink-primary text-sm font-medium">
        {U.title} ({parcels.length})
      </h3>
      <Alert tone={acknowledged && !shipsWhole ? "info" : "warning"}>
        {trayNotice(shipsWhole, acknowledged)}
        {canAcknowledge && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-2 h-auto p-0"
            onClick={onAcknowledge}
          >
            {L.actions.acknowledge}
          </Button>
        )}
      </Alert>
      <UnplacedTable
        parcels={parcels}
        returnable={returnable}
        selected={selected}
        onToggle={onToggle}
      />
      {returnable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || selected.size === 0}
            onClick={onReturn}
          >
            {U.returnToVehicle(vehicleSeq)}
          </Button>
          <span className="text-ink-tertiary text-xs">
            {U.returnHint} {hasKit && U.kitNote}
          </span>
        </div>
      )}
    </section>
  );
}
