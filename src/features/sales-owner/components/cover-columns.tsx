"use client";

import { CalendarX2 } from "lucide-react";

import { formatDate } from "@/lib/format/date";

import { CELL, ToneDot } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { canCancelCover } from "../lifecycle";
import { COVER_STATE_LABELS, coverState } from "../selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CoverState } from "../selectors";
import type { StaffCover } from "../types";

const TONE: Record<CoverState, "positive" | "info" | "muted" | "neutral"> = {
  ACTIVE: "positive",
  UPCOMING: "info",
  ENDED: "muted",
  CANCELLED: "neutral",
};

/** Cột lịch người thay; "Huỷ lịch…" theo `canCancelCover` (BR-S07). */
export function coverColumns({
  today,
  ctx,
  onCancel,
}: {
  today: string;
  ctx: { userId: string | null; canUpdate: boolean; isManager: boolean };
  onCancel: (cover: StaffCover) => void;
}): ColumnDef<StaffCover>[] {
  return [
    {
      key: "user",
      header: "Sale vắng",
      className: "min-w-40",
      cell: (c) => <span className={CELL.name}>{c.userName ?? "—"}</span>,
    },
    {
      key: "cover",
      header: "Người thay",
      className: "min-w-40",
      cell: (c) => c.coverUserName ?? "—",
    },
    {
      key: "period",
      header: "Thời gian",
      className: "whitespace-nowrap",
      cell: (c) => (
        <span className={CELL.date}>
          {formatDate(c.from)} – {formatDate(c.to)}
        </span>
      ),
    },
    {
      key: "state",
      header: "Trạng thái",
      cell: (c) => {
        const state = coverState(c, today);
        return <ToneDot tone={TONE[state]} label={COVER_STATE_LABELS[state]} />;
      },
    },
    {
      key: "reason",
      header: "Lý do",
      className: "min-w-40 whitespace-normal text-ink-secondary",
      cell: (c) => c.reason || "—",
    },
    rowActionsColumn<StaffCover>((c) => {
      const allowed = canCancelCover(c, coverState(c, today), ctx);
      return {
        label: `Thao tác — lịch của ${c.userName ?? c.userId}`,
        actions: [
          {
            label: "Huỷ lịch…",
            icon: CalendarX2,
            danger: true,
            disabled: !allowed,
            hint: allowed ? undefined : "Chỉ huỷ được lịch chưa hết, của mình (quản lý: mọi lịch).",
            onSelect: () => onCancel(c),
          },
        ],
      };
    }),
  ];
}
