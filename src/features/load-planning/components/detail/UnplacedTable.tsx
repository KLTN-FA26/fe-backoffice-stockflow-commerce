"use client";

import { LOAD_PLAN_UNPLACED_REASON_LABELS, UI_LABELS } from "@/constants";
import { formatFixed } from "@/lib/format";
import { formatNominalCm } from "@/features/load-planning/lib/dims";
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

const U = UI_LABELS.loadPlan.detail.unplaced;

/** Bảng kiện chưa xếp: tên + mã nhãn, lý do (tiếng Việt), kích thước, khối lượng; có ô chọn khi được đưa lại vào xe. */
export function UnplacedTable({
  parcels,
  returnable,
  selected,
  onToggle,
}: {
  parcels: readonly PlanParcel[];
  /** Hiện ô chọn kiện để đưa lại vào xe. */
  returnable: boolean;
  selected: ReadonlySet<string>;
  onToggle: (packageId: string) => void;
}) {
  return (
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
                <span className="text-ink-tertiary ml-2 font-mono text-xs">{parcel.labelCode}</span>
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
  );
}
