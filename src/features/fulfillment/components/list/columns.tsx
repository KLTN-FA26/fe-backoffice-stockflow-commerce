"use client";

import Link from "next/link";
import { UserCog } from "lucide-react";

import { ADMIN_ROUTES, FULFILLMENT_COLUMNS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { allowedFulfillmentActions } from "@/features/fulfillment/lifecycle";
import { integrityOutcome, verificationCount } from "@/features/fulfillment/selectors";
import { statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

import { MONO, assigneeLabel, orderLabel, taskCode } from "../primitives";
import { COLUMN_LABELS } from "./constants";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { IntegrityOutcome } from "@/features/fulfillment/selectors";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { FulfillmentScope } from "../primitives";
import type { TaskReferences } from "../useFulfillmentActor";

const C = FULFILLMENT_COLUMNS;
const CELL = "text-[0.8125rem]";
const INTEGRITY = UI_LABELS.fulfillment.integrity;

const INTEGRITY_TEXT: Record<IntegrityOutcome, { label: string; className: string }> = {
  unverified: { label: INTEGRITY.unverified, className: "text-ink-tertiary" },
  match: { label: INTEGRITY.match, className: "text-positive" },
  mismatch: { label: INTEGRITY.mismatch, className: "text-danger font-medium" },
};

function dateTimeCell(
  key: string,
  getValue: (row: FulfillmentTask) => string | null | undefined,
): ColumnDef<FulfillmentTask> {
  return {
    key,
    header: COLUMN_LABELS[key] ?? key,
    cell: (row) => {
      const value = getValue(row);
      return (
        <span className={`text-ink-secondary tabular-nums ${CELL}`}>
          {value ? formatDateTime(value) : "—"}
        </span>
      );
    },
  };
}

export interface TaskColumnContext {
  scope: FulfillmentScope;
  actor: FulfillmentActor;
  refs: TaskReferences;
  onAssign: (task: FulfillmentTask) => void;
}

/** Cột bảng task — chỉ field có trong BE `FulfillmentTaskResponse`; số đơn / tên tra qua `refs`. */
export function buildTaskColumns({
  scope,
  actor,
  refs,
  onAssign,
}: TaskColumnContext): ColumnDef<FulfillmentTask>[] {
  return [
    {
      key: C.TASK,
      header: COLUMN_LABELS[C.TASK] ?? C.TASK,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES[scope].detail(row.taskId)}
          title={row.taskId}
          className={`text-accent font-medium hover:underline ${MONO} ${CELL}`}
          onClick={(event) => event.stopPropagation()}
        >
          {taskCode(row.taskId)}
        </Link>
      ),
    },
    {
      key: C.ORDER,
      header: COLUMN_LABELS[C.ORDER] ?? C.ORDER,
      cell: (row) => (
        <span className={`text-ink-primary ${MONO} ${CELL}`} title={row.orderId}>
          {orderLabel(row.orderId, refs.orderNumbers)}
        </span>
      ),
    },
    {
      key: C.ASSIGNEE,
      header: COLUMN_LABELS[C.ASSIGNEE] ?? C.ASSIGNEE,
      cell: (row) => (
        <span className={`text-ink-primary ${CELL}`} title={row.assignedUserId ?? undefined}>
          {assigneeLabel(row.assignedUserId, refs.userNames, actor.userId)}
        </span>
      ),
    },
    statusCell<FulfillmentTask>(
      C.PICK_STATUS,
      COLUMN_LABELS[C.PICK_STATUS] ?? C.PICK_STATUS,
      (row) => row.pickStatus,
      "pick",
    ),
    statusCell<FulfillmentTask>(
      C.PACK_STATUS,
      COLUMN_LABELS[C.PACK_STATUS] ?? C.PACK_STATUS,
      (row) => row.packStatus,
      "pack",
    ),
    dateTimeCell(C.ASSIGNED_AT, (row) => row.assignedAt),
    dateTimeCell(C.STARTED_AT, (row) => row.startedAt),
    dateTimeCell(C.PICKED_AT, (row) => row.pickedAt),
    dateTimeCell(C.PACKED_AT, (row) => row.packedAt),
    {
      key: C.INTEGRITY,
      header: COLUMN_LABELS[C.INTEGRITY] ?? C.INTEGRITY,
      cell: (row) => {
        const { label, className } = INTEGRITY_TEXT[integrityOutcome(row)];
        const count = verificationCount(row);
        return (
          <span className={`${className} ${CELL}`}>
            {label}
            {count > 0 && <span className="text-ink-tertiary tabular-nums"> · {count} lần</span>}
          </span>
        );
      },
    },
    {
      key: C.ACTIONS,
      header: "",
      cell: (row) => {
        const canAssign = allowedFulfillmentActions(row, actor).some((a) => a.code === "assign");
        if (scope !== "picking" || !canAssign) return null;
        return (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              onAssign(row);
            }}
            className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
            aria-label={`${UI_LABELS.fulfillment.action.assign} task ${taskCode(row.taskId)}`}
          >
            <UserCog className="size-3.5" />
          </Button>
        );
      },
    },
  ];
}
