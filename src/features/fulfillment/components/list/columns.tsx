"use client";

import Link from "next/link";
import { UserCog } from "lucide-react";

import { ADMIN_ROUTES, FULFILLMENT_COLUMNS, UI_LABELS } from "@/constants";
import { allowedFulfillmentActions } from "@/features/fulfillment/lifecycle";
import { integrityOutcome, verificationCount } from "@/features/fulfillment/selectors";
import {
  CELL,
  dateCell,
  statusCell,
  ToneDot,
  ViewAction,
} from "@/components/shared/column-helpers";

import { assigneeLabel, orderLabel, taskCode } from "../primitives";
import { COLUMN_LABELS } from "./constants";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { IntegrityOutcome } from "@/features/fulfillment/selectors";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { FulfillmentScope } from "../primitives";
import type { TaskReferences } from "../useFulfillmentActor";

const C = FULFILLMENT_COLUMNS;
const INTEGRITY = UI_LABELS.fulfillment.integrity;

const INTEGRITY_TONE: Record<
  IntegrityOutcome,
  { label: string; tone: "neutral" | "positive" | "danger" }
> = {
  unverified: { label: INTEGRITY.unverified, tone: "neutral" },
  match: { label: INTEGRITY.match, tone: "positive" },
  mismatch: { label: INTEGRITY.mismatch, tone: "danger" },
};

function dateTimeCell(
  key: string,
  getValue: (row: FulfillmentTask) => string | null | undefined,
): ColumnDef<FulfillmentTask> {
  return dateCell(key, COLUMN_LABELS[key] ?? key, getValue, { withTime: true });
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
          className={`${CELL.code} hover:underline`}
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
        <span className={CELL.ref} title={row.orderId}>
          {orderLabel(row.orderId, refs.orderNumbers)}
        </span>
      ),
    },
    {
      key: C.ASSIGNEE,
      header: COLUMN_LABELS[C.ASSIGNEE] ?? C.ASSIGNEE,
      cell: (row) => (
        <span className={CELL.name} title={row.assignedUserId ?? undefined}>
          {assigneeLabel(row.assignedUserId, row.assignedUserName, actor.userId)}
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
        const { label, tone } = INTEGRITY_TONE[integrityOutcome(row)];
        const count = verificationCount(row);
        return (
          <span className="inline-flex items-center gap-1.5">
            <ToneDot tone={tone} label={label} />
            {count > 0 && <span className={`${CELL.sub} tabular-nums`}>· {count} lần</span>}
          </span>
        );
      },
    },
    {
      key: C.ACTIONS,
      header: "",
      // Nút xem luôn có (dòng cao chuẩn 43px); nút giao việc chỉ khi lifecycle cho phép
      cell: (row) => {
        const canAssign =
          scope === "picking" &&
          allowedFulfillmentActions(row, actor).some((a) => a.code === "assign");
        return (
          <div className="flex items-center gap-1.5">
            <ViewAction
              label={`Xem task ${taskCode(row.taskId)}`}
              href={ADMIN_ROUTES[scope].detail(row.taskId)}
            />
            {canAssign && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAssign(row);
                }}
                className={CELL.action}
                aria-label={`${UI_LABELS.fulfillment.action.assign} task ${taskCode(row.taskId)}`}
              >
                <UserCog className="size-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];
}
