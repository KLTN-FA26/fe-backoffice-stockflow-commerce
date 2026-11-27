"use client";

import Link from "next/link";
import { Eye, UserCog } from "lucide-react";

import { FULFILLMENT_COLUMNS, UI_LABELS } from "@/constants";
import { allowedFulfillmentActions } from "@/features/fulfillment/lifecycle";
import { CELL, dateCell, statusCell } from "@/components/shared/column-helpers";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { assigneeLabel, orderLabel, taskCode } from "../primitives";
import { COLUMN_LABELS } from "./constants";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { FulfillmentScope } from "../primitives";

const C = FULFILLMENT_COLUMNS;

function dateTimeCell(
  key: string,
  getValue: (row: FulfillmentTask) => string | null | undefined,
): ColumnDef<FulfillmentTask> {
  return dateCell(key, COLUMN_LABELS[key] ?? key, getValue, { withTime: true });
}

export interface TaskColumnContext {
  scope: FulfillmentScope;
  actor: FulfillmentActor;
  onAssign: (task: FulfillmentTask) => void;
  /** Link chi tiết task — trong tab theo kho (`WORKSPACE_PATHS.pickingTask`). */
  detailHref: (taskId: string) => string;
}

/** Cột bảng task — chỉ field có trong BE `FulfillmentTaskResponse` (số đơn, tên người gán đi kèm task). */
export function buildTaskColumns({
  scope,
  actor,
  onAssign,
  detailHref,
}: TaskColumnContext): ColumnDef<FulfillmentTask>[] {
  return [
    {
      key: C.TASK,
      header: COLUMN_LABELS[C.TASK] ?? C.TASK,
      cell: (row) => (
        <Link
          href={detailHref(row.taskId)}
          title={row.taskId}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {taskCode(row)}
        </Link>
      ),
    },
    {
      key: C.ORDER,
      header: COLUMN_LABELS[C.ORDER] ?? C.ORDER,
      cell: (row) => (
        <span className={CELL.ref} title={row.orderId}>
          {orderLabel(row.orderId, row.orderNumber)}
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
      key: C.ACTIONS,
      header: "Thao tác",
      align: "right",
      className: "w-20",
      // Xem luôn có; giao việc chỉ khi lifecycle cho phép
      cell: (row) => {
        const canAssign =
          scope === "picking" &&
          allowedFulfillmentActions(row, actor).some((a) => a.code === "assign");
        return (
          <RowActionsMenu
            label={`Thao tác — task ${taskCode(row)}`}
            actions={[
              { label: "Xem chi tiết", icon: Eye, href: detailHref(row.taskId) },
              ...(canAssign
                ? [
                    {
                      label: UI_LABELS.fulfillment.action.assign,
                      icon: UserCog,
                      onSelect: () => onAssign(row),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
    },
  ];
}
