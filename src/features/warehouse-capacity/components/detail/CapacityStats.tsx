"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleDashed,
  Clock,
  Gauge,
  PackageOpen,
} from "lucide-react";

import { UI_LABELS } from "@/constants";

import { freeTone, usageTone } from "@/features/warehouse-capacity/selectors";

import { StatCell, StatStrip } from "@/components/shared/StatStrip";

import { formatM3Unit, formatShare } from "../parts";

import type { CapacityBoard } from "@/features/warehouse-capacity/types";

const M = UI_LABELS.warehouseCapacity.metric;
const H = UI_LABELS.warehouseCapacity.hint;

const withShare = (m3: number, percent: number | null | undefined) =>
  percent === null || percent === undefined
    ? formatM3Unit(m3)
    : `${formatM3Unit(m3)} · ${formatShare(percent)}`;

/**
 * Bảy cột của Bảng sức chứa ở cấp kho (docs 06 §4.6 bước 3, BR-20) — đúng thứ tự docs, hai hàng (4 + 3) để m³ kèm %
 * không bị cắt. Còn trống âm tô `danger` (BR-21); Sắp xuất là tham khảo, không cộng vào chỗ trống. Chú thích công
 * thức ở tooltip từng ô.
 */
export function CapacityStats({ board }: { board: CapacityBoard }) {
  return (
    <StatStrip columns="grid-cols-2 md:grid-cols-4">
      <StatCell
        label={M.capacity}
        title={H.capacity}
        icon={Gauge}
        tone="info"
        mono
        value={formatM3Unit(board.capacityM3)}
      />
      <StatCell
        label={M.occupied}
        title={H.occupied}
        icon={Boxes}
        tone={usageTone(board.occupiedPercent)}
        mono
        value={withShare(board.occupiedM3, board.occupiedPercent)}
      />
      <StatCell
        label={M.incoming}
        title={H.incoming}
        icon={ArrowDownToLine}
        tone="special"
        mono
        value={formatM3Unit(board.incomingM3)}
      />
      <StatCell
        label={M.projectedFree}
        title={H.projectedFree}
        icon={PackageOpen}
        tone={freeTone(board.projectedFreeM3) === "danger" ? "danger" : "positive"}
        mono
        value={withShare(board.projectedFreeM3, board.projectedFreePercent)}
      />
      <StatCell
        label={M.pending}
        title={H.pending}
        icon={Clock}
        tone="warning"
        mono
        value={formatM3Unit(board.pendingM3)}
      />
      <StatCell
        label={M.freeIfAllApproved}
        title={H.freeIfAllApproved}
        icon={CircleDashed}
        tone={freeTone(board.freeIfAllApprovedM3)}
        mono
        value={formatM3Unit(board.freeIfAllApprovedM3)}
      />
      <StatCell
        label={UI_LABELS.warehouseCapacity.column.outgoing}
        title={H.outgoing}
        icon={ArrowUpFromLine}
        tone="neutral"
        mono
        value={formatM3Unit(board.outgoingM3)}
      />
    </StatStrip>
  );
}
