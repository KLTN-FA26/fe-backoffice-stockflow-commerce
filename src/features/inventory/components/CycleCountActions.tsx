"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  CYCLE_COUNT_ACTION,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_ROUTES,
  CYCLE_COUNT_STATUS,
} from "@/constants/cycle-count";
import { INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { usePermissionChecker } from "@/lib/auth";

import { Button } from "@/components/ui/button";

import { cycleCountActionError } from "../cycle-count-errors";
import { allowedCycleCountActions } from "../cycle-count-lifecycle";
import {
  useCancelCycleCount,
  useRecountCycleCount,
  useSubmitCycleCount,
} from "../cycle-count-mutations";
import { isFullyCounted } from "../cycle-count-selectors";
import { CYCLE_COUNT_ACTION_COPY, CycleCountActionDialog } from "./CycleCountActionDialog";

import type { CycleCount } from "../cycle-count-types";
import type { CycleCountActionKind as Action } from "./CycleCountActionDialog";

const L = CYCLE_COUNT_LABELS;

/**
 * Nộp / huỷ / đếm lại (docs 20 §4.2 c–e): `allowedCycleCountActions(status, can)` quyết định nút nào hiện; nộp chỉ bấm
 * được khi mọi thùng đã đếm. UI-only — BE kiểm quyền, người được giao và trạng thái.
 */
export function CycleCountActions({
  count,
  recountLineIds,
}: {
  count: CycleCount;
  /** Các dòng đã chọn để đếm lại (chỉ dòng có điều chỉnh bị từ chối). */
  recountLineIds: readonly string[];
}) {
  const router = useRouter();
  const can = usePermissionChecker();
  const actions = allowedCycleCountActions(count.status, can);
  const submit = useSubmitCycleCount(count.id);
  const cancel = useCancelCycleCount(count.id);
  const recount = useRecountCycleCount(count.id);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ detail: string; traceId?: string } | null>(null);
  const running = useRef(false);
  const pending = submit.isPending || cancel.isPending || recount.isPending;
  const fullyCounted = isFullyCounted(count.lines);
  const close = () => {
    setAction(null);
    setNote("");
    setError(null);
  };
  const confirm = async (reason?: string) => {
    if (running.current || pending || !action || !actions.includes(action)) return;
    running.current = true;
    setError(null);
    try {
      if (action === CYCLE_COUNT_ACTION.SUBMIT) await submit.mutateAsync();
      if (action === CYCLE_COUNT_ACTION.CANCEL) await cancel.mutateAsync({ reason: reason ?? "" });
      if (action === CYCLE_COUNT_ACTION.RECOUNT) {
        // Phiếu cũ giữ nguyên; người quản lý được đưa sang phiếu kiểm mù mới.
        const next = await recount.mutateAsync({ lineIds: [...recountLineIds], note });
        router.push(CYCLE_COUNT_ROUTES.detail(next.id));
      }
      close();
    } catch (failure: unknown) {
      setError(cycleCountActionError(failure));
    } finally {
      running.current = false;
    }
  };
  const dialogAction = action && actions.includes(action) ? action : null;
  const errorView = error && (
    <>
      <p>{error.detail}</p>
      {error.traceId && <p>{`${L.trace}: ${error.traceId}`}</p>}
    </>
  );
  const blocked: Record<Action, boolean> = {
    [CYCLE_COUNT_ACTION.SUBMIT]: !fullyCounted,
    [CYCLE_COUNT_ACTION.CANCEL]: false,
    [CYCLE_COUNT_ACTION.RECOUNT]: recountLineIds.length === 0,
  };
  const canDecideAdjustments = can(INVENTORY_PERMISSIONS.adjustmentRead);
  return (
    <div className="space-y-[var(--el-gap)]">
      <div className="flex flex-wrap items-center gap-[var(--el-gap)]">
        {actions.map((value) => (
          <Button
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
            key={value}
            type="button"
            disabled={pending || blocked[value]}
            variant={value === CYCLE_COUNT_ACTION.SUBMIT ? "default" : "outline"}
            onClick={() => setAction(value)}
          >
            {CYCLE_COUNT_ACTION_COPY[value].title}
          </Button>
        ))}
        {count.status === CYCLE_COUNT_STATUS.COMPLETED && canDecideAdjustments && (
          <Button asChild variant="link" size="sm">
            <Link
              href={`${INVENTORY_ROUTES.adjustments}?status=${STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL}`}
            >
              {L.pendingAdjustments}
            </Link>
          </Button>
        )}
      </div>
      {actions.includes(CYCLE_COUNT_ACTION.SUBMIT) && !fullyCounted && (
        <p className="text-ink-secondary text-sm">{L.submitBlocked}</p>
      )}
      {actions.includes(CYCLE_COUNT_ACTION.RECOUNT) && (
        <p className="text-ink-secondary text-sm">{L.recountHint}</p>
      )}
      {pending && <p role="status">{L.submitting}</p>}
      {error && !dialogAction && (
        <div role="alert" className="text-danger">
          {errorView}
        </div>
      )}
      {dialogAction && (
        <CycleCountActionDialog
          action={dialogAction}
          pending={pending}
          error={errorView}
          note={note}
          onNote={setNote}
          onClose={close}
          onConfirm={(reason) => void confirm(reason)}
        />
      )}
    </div>
  );
}
