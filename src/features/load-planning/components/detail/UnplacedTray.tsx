"use client";

import { LOAD_PLAN_UNPLACED_REASON_LABELS, UI_LABELS } from "@/constants";
import { formatFixed } from "@/lib/format";
import { formatNominalCm } from "@/features/load-planning/lib/dims";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { PlanParcel } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.detail;
const U = L.unplaced;

interface UnplacedTrayProps {
  parcels: readonly PlanParcel[];
  acknowledged: boolean;
  /** Được tính lại xe (`:UPDATE`, kế hoạch PLANNED): hiện ô chọn kiện và nút "đưa lại vào xe". */
  canReturn: boolean;
  /** Được xác nhận để lại các kiện này: hiện nút ngay trong khay. */
  canAcknowledge: boolean;
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
      <Alert tone={acknowledged ? "info" : "warning"}>
        {acknowledged ? U.acknowledged : U.pending}
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
      <div className="border-border-default overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              {returnable && <TableHead className="w-8" />}
              <TableHead>{U.parcel}</TableHead>
              <TableHead>{U.reasonColumn}</TableHead>
              <TableHead className="text-right">{U.dimensions}</TableHead>
              <TableHead className="text-right">{U.weight}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcels.map((parcel) => (
              <TableRow key={parcel.packageId}>
                {returnable && (
                  <TableCell>
                    <Checkbox
                      checked={selected.has(parcel.packageId)}
                      onCheckedChange={() => onToggle(parcel.packageId)}
                      aria-label={`${U.selectToReturn}: ${parcel.labelCode}`}
                    />
                  </TableCell>
                )}
                <TableCell className="text-[0.8125rem]">
                  <span className="font-medium">{parcel.partName}</span>
                  <span className="text-ink-tertiary ml-2 font-mono text-xs">
                    {parcel.labelCode}
                  </span>
                </TableCell>
                <TableCell className="text-warning text-[0.8125rem]">
                  {parcel.unplacedReason
                    ? LOAD_PLAN_UNPLACED_REASON_LABELS[parcel.unplacedReason]
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatNominalCm({ l: parcel.lengthMm, w: parcel.widthMm, h: parcel.heightMm })}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatFixed(parcel.weightKg, 1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
