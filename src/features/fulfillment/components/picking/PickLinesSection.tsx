"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  PICK_LINE_LABELS,
  PICK_STATUS,
  PUT_BACK_LABELS,
  UI_LABELS,
} from "@/constants";
import {
  awaitingPutBackCount,
  needsLinePlanning,
  pickProgress,
  printLineCount,
  shortLineCount,
} from "@/features/fulfillment/pick-line-selectors";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { PickLinesTable } from "./PickLinesTable";
import { PlanLinesNotice } from "./PlanLinesNotice";

import type { FulfillmentTask, PickLine } from "@/features/fulfillment/types";
import type { ComponentProps } from "react";

const L = PICK_LINE_LABELS;

/**
 * Danh sách dòng lấy hàng của task (BE `GET /tasks/{id}/pick-lines`, SCRUM-267): tiến độ, bảng theo
 * lộ trình, ghi chú dòng in (BR-06, docs 07 §6), số dòng chờ trả về kệ khi đơn đã huỷ và đơn tạm giữ vì
 * dòng thiếu (X-SHORT: BE đưa đơn sang ON_HOLD tới khi phân bổ lại).
 */
export function PickLinesSection({
  task,
  lines,
  isPending,
  error,
  onRetry,
  canOpenPutBacks = false,
  ...table
}: {
  task: FulfillmentTask;
  lines: readonly PickLine[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  /** Người xem có `fulfillment-picking:READ` → hiện link sang hàng đợi trả về kệ. */
  canOpenPutBacks?: boolean;
} & Omit<ComponentProps<typeof PickLinesTable>, "lines">) {
  const printLines = printLineCount(task);

  function body() {
    if (error) {
      return (
        <Alert tone="danger" title={L.loadError}>
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0 align-baseline"
            onClick={onRetry}
          >
            {UI_LABELS.common.retry}
          </Button>
        </Alert>
      );
    }
    if (isPending || !lines) return <Skeleton className="h-40 w-full" />;
    if (needsLinePlanning(task, lines)) {
      return <PlanLinesNotice taskId={task.taskId} canPlan={table.canSelect} />;
    }
    if (lines.length === 0) {
      // BE lập dòng lúc tạo task; task cũ hơn được lập lúc bắt đầu lấy hàng. Còn lại = đơn chỉ có dòng in
      const text = task.pickStatus === PICK_STATUS.PENDING ? L.notPlanned : L.printOnly;
      return <p className="text-ink-secondary text-[0.8125rem]">{text}</p>;
    }
    const awaiting = awaitingPutBackCount(task, lines);
    // Đơn huỷ thì dòng Thiếu vẫn giữ SHORT (BE chỉ huỷ dòng Open) — "tạm giữ chờ phân bổ lại" chỉ khi đang lấy
    const shortLines = task.pickStatus === PICK_STATUS.PICKING ? shortLineCount(lines) : 0;
    const { picked, total } = pickProgress(lines);
    return (
      <div className="space-y-3">
        {awaiting > 0 && (
          <Alert tone="warning" title={L.awaitingPutBack(awaiting)}>
            {canOpenPutBacks && task.warehouseId ? (
              <Link
                href={ADMIN_ROUTES.putBacks.listInWarehouse(task.warehouseId)}
                className="text-accent font-medium hover:underline"
              >
                {PUT_BACK_LABELS.openQueue}
              </Link>
            ) : null}
          </Alert>
        )}
        {shortLines > 0 && (
          <Alert tone="warning" title={L.onHoldForShort(shortLines)}>
            {null}
          </Alert>
        )}
        <div className="flex items-center gap-3">
          <span className="text-ink-primary text-[0.8125rem] font-medium tabular-nums">
            {L.progress(picked, total)}
          </span>
          <progress
            value={picked}
            max={total}
            aria-label={L.progress(picked, total)}
            className="accent-positive h-1.5 flex-1"
          />
        </div>
        <PickLinesTable lines={lines} {...table} />
      </div>
    );
  }

  return (
    <Section title={L.sectionTitle} description={L.sectionDescription}>
      {body()}
      {printLines > 0 && (
        <p className="text-ink-tertiary mt-3 text-xs">{L.printLines(printLines)}</p>
      )}
    </Section>
  );
}
