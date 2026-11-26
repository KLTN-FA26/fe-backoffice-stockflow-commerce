"use client";

import Link from "next/link";
import { Eye, PackageCheck } from "lucide-react";

import { ADMIN_ROUTES, PUTAWAY_COLUMNS as C, PUTAWAY_LABELS, PUTAWAY_SOURCE } from "@/constants";
import { formatNumber } from "@/lib/format";
import { isPutawayTaskClosed } from "@/features/putaway/lifecycle";

import { CELL, EmptyCell, statusCell } from "@/components/shared/column-helpers";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PutawayTask } from "@/features/putaway/types";
import type { PutawayColumn } from "./usePutawayColumns";

const L = PUTAWAY_LABELS;
const byText =
  (pick: (row: PutawayTask) => string | null | undefined) => (a: PutawayTask, b: PutawayTask) =>
    (pick(a) ?? "").localeCompare(pick(b) ?? "", "vi");

function SourceCell({ row }: { row: PutawayTask }) {
  if (row.source === PUTAWAY_SOURCE.RECEIPT && row.goodsReceiptId) {
    return (
      <Link
        href={ADMIN_ROUTES.receipts.detail(row.goodsReceiptId)}
        className={`${CELL.text} hover:text-ink-primary hover:underline`}
      >
        {L.source.RECEIPT}
      </Link>
    );
  }
  return <span className={CELL.text}>{L.source[row.source]}</span>;
}

/** Nút thao tác có chữ (biểu tượng trơn khó đoán ý) — cao 44px trên màn cảm ứng của kho. */
const ACTION_BUTTON =
  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted inline-flex h-7 items-center gap-1.5 rounded-[var(--r-sm)] border px-2.5 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:h-11 pointer-coarse:px-3 pointer-coarse:text-[0.8125rem]";

/** Cất được → "Cất"; đã xong / không còn thao tác → "Xem". Cùng một đích: màn cất một thùng. */
function ActionCell({ row, href }: { row: PutawayTask; href: string }) {
  const lpn = row.lpn ?? row.id;
  // Nút là `flex` nên `text-right` của ô không đẩy được — bọc `justify-end` để thẳng mép với tiêu đề cột
  if (isPutawayTaskClosed(row.status)) {
    return (
      <div className="flex justify-end">
        <Link href={href} aria-label={L.view(lpn)} className={ACTION_BUTTON}>
          <Eye className="size-3.5" />
          {L.viewShort}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <Link href={href} aria-label={L.putAway(lpn)} className={ACTION_BUTTON}>
        <PackageCheck className="text-dot-positive size-3.5" />
        {L.putAwayShort}
      </Link>
    </div>
  );
}

/** Cột danh sách cất hàng (docs 05 §4.2) — dữ liệu theo `visible`, cột thao tác luôn ở cuối. */
export function putawayColumns(
  visible: readonly PutawayColumn[],
  /** Link màn cất một thùng — trong tab theo kho (`WORKSPACE_PATHS.putawayTask`). */
  taskHref: (taskId: string) => string,
): ColumnDef<PutawayTask>[] {
  const col = L.column;
  const all: Record<PutawayColumn, ColumnDef<PutawayTask>> = {
    [C.LPN]: {
      key: C.LPN,
      header: col.lpn,
      sortable: true,
      compare: byText((row) => row.lpn),
      cell: (row) =>
        row.lpn ? (
          <Link href={taskHref(row.id)} className={`${CELL.code} hover:underline`}>
            {row.lpn}
          </Link>
        ) : (
          <EmptyCell />
        ),
    },
    [C.SKU]: {
      key: C.SKU,
      header: col.sku,
      sortable: true,
      compare: byText((row) => row.sku),
      cell: (row) => <span className={CELL.ref}>{row.sku}</span>,
    },
    [C.LOT]: {
      key: C.LOT,
      header: col.lot,
      cell: (row) =>
        row.lotNumber ? <span className={CELL.ref}>{row.lotNumber}</span> : <EmptyCell />,
    },
    [C.QUANTITY]: {
      key: C.QUANTITY,
      header: col.quantity,
      align: "right",
      sortable: true,
      compare: (a, b) => a.quantity - b.quantity,
      cell: (row) => <span className={CELL.number}>{formatNumber(row.quantity)}</span>,
    },
    [C.SOURCE_LOCATION]: {
      key: C.SOURCE_LOCATION,
      header: col.sourceLocation,
      sortable: true,
      compare: byText((row) => row.sourceLocationCode),
      cell: (row) => <span className={CELL.ref}>{row.sourceLocationCode}</span>,
    },
    [C.SOURCE]: {
      key: C.SOURCE,
      header: col.source,
      cell: (row) => <SourceCell row={row} />,
    },
    [C.STATUS]: statusCell(C.STATUS, col.status, (row) => row.status, "putaway"),
    [C.ACTION]: {
      key: C.ACTION,
      header: col.action,
      align: "right",
      cell: (row) => <ActionCell row={row} href={taskHref(row.id)} />,
    },
  };
  return [...visible.map((key) => all[key]), all[C.ACTION]];
}
