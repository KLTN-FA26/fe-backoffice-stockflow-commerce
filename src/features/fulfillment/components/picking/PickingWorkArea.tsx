"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { FULFILLMENT_PICK_PERMISSIONS, PICK_LINE_LABELS, PICK_STATUS } from "@/constants";
import { useWarehouseLocations } from "@/lib/references/warehouse-locations";
import {
  canConfirmPickLines,
  canReallocate,
  canViewPutBacks,
  canReportShort,
  isConfirmableLine,
  isReallocatableLine,
} from "@/features/fulfillment/pick-line-lifecycle";
import {
  linesComplete,
  nextOpenLine,
  pickIncompleteReason,
  pickLocationOptions,
} from "@/features/fulfillment/pick-line-selectors";
import { usePickLines } from "@/features/fulfillment/queries";

import { TaskActionCard } from "../detail/TaskActionCard";
import { PickLineConfirmCard } from "./PickLineConfirmCard";
import { PickLinesSection } from "./PickLinesSection";
import { ReallocateButton } from "./ReallocateButton";
import { ShortPickAction } from "./ShortPickAction";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask, PickLine } from "@/features/fulfillment/types";
import type { ReactNode } from "react";

const L = PICK_LINE_LABELS;

/**
 * Vùng làm việc của màn lấy hàng: bảng dòng (trái) + thẻ xác nhận dòng và thẻ thao tác task (phải).
 * Dòng đang làm = dòng người dùng chọn nếu còn mở, không thì dòng mở kế tiếp theo lộ trình.
 */
export function PickingWorkArea({
  task,
  actor,
  info,
}: {
  task: FulfillmentTask;
  actor: FulfillmentActor;
  /** Thông tin task + dòng đơn, đặt dưới bảng dòng. */
  info: ReactNode;
}) {
  const lines = usePickLines(task.taskId, actor.can(FULFILLMENT_PICK_PERMISSIONS.read));
  // UI-only — Backend phải re-check (picking:UPDATE + người được gán; phân bổ lại: task-assignment:UPDATE)
  const canConfirm = canConfirmPickLines(task, actor);
  const canRealloc = canReallocate(task, actor);
  const locations = useWarehouseLocations(task.warehouseId ?? undefined, canConfirm);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  // Câu "Đã lấy dòng …" chỉ nói thao tác vừa làm: báo thiếu / phân bổ lại xong thì bỏ
  const [lastDone, setLastDone] = useState<string | null>(null);
  const clearDone = () => setLastDone(null);

  const data = lines.data;
  const selected = data?.find((line) => line.lineId === selectedId && isConfirmableLine(line));
  const active = data ? (selected ?? nextOpenLine(data)) : undefined;
  const picking = task.pickStatus === PICK_STATUS.PICKING;
  // Chưa tải xong dòng thì chưa cho hoàn tất (BE requireAllPicked)
  const complete = !!data && linesComplete(data, task);
  const incompleteReason = pickIncompleteReason(data, lines.isError, task);
  const locationOptions = pickLocationOptions(locations.data, data ?? []);
  const onConfirmed = (line: PickLine) => {
    setSelectedId(undefined);
    setLastDone(L.done(line.sequenceNo));
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <PickLinesSection
          canOpenPutBacks={canViewPutBacks(actor)}
          task={task}
          lines={data}
          isPending={lines.isPending}
          error={lines.error}
          onRetry={() => void lines.refetch()}
          activeLineId={canConfirm ? active?.lineId : undefined}
          onSelect={setSelectedId}
          canSelect={canConfirm}
          lineAction={
            canRealloc
              ? (line) =>
                  isReallocatableLine(line) && (
                    <ReallocateButton taskId={task.taskId} line={line} onReallocated={clearDone} />
                  )
              : undefined
          }
        />
        {info}
      </div>
      <div className="space-y-5">
        {canConfirm && lastDone && (
          <p role="status" className="text-positive flex items-center gap-1.5 text-[0.8125rem]">
            <CheckCircle2 className="size-4" /> {lastDone}
          </p>
        )}
        {canConfirm && data && active && (
          <PickLineConfirmCard
            key={active.lineId}
            taskId={task.taskId}
            line={active}
            lines={data}
            locationOptions={locationOptions}
            locationsUnavailable={locations.isError}
            onConfirmed={onConfirmed}
            extraActions={
              canReportShort(task, actor) && (
                <ShortPickAction
                  taskId={task.taskId}
                  line={active}
                  locationOptions={locationOptions}
                  onReported={clearDone}
                />
              )
            }
          />
        )}
        {canConfirm && data && data.length > 0 && complete && (
          <p className="text-positive text-[0.8125rem]">{L.allPicked}</p>
        )}
        {picking && !canConfirm && <p className="text-ink-tertiary text-xs">{L.onlyAssignee}</p>}
        <TaskActionCard
          task={task}
          scope="picking"
          actor={actor}
          linesComplete={complete}
          incompleteReason={canConfirm ? incompleteReason : undefined}
        />
      </div>
    </div>
  );
}
