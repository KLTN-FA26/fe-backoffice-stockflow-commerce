"use client";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ConfirmBlock, LoadPlanActions } from "@/features/load-planning/lifecycle";

const L = UI_LABELS.loadPlan.detail;
const BLOCK_TEXT: Record<ConfirmBlock, string> = {
  noVehicles: L.noVehicles,
  needsRecalculation: L.needsRecalculationAlert,
  unplacedPending: L.unplaced.pending,
};

export type PlanDialogKind =
  "calculate" | "acknowledge" | "confirm" | "reopen" | "cancel" | "editInputs";

const PRIMARY = "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse";

/**
 * Nút thao tác theo `loadPlanActions` (trạng thái + quyền `:UPDATE`): terminal state không có nút. Nút chốt luôn hiện
 * khi đúng trạng thái nhưng khoá kèm lý do (chưa xác nhận kiện chưa xếp, xe cần tính lại…).
 */
export function PlanActions({
  actions,
  onOpen,
  onEdit,
}: {
  actions: LoadPlanActions;
  onOpen: (kind: PlanDialogKind) => void;
  /** Mở trình soạn xếp tay (PR F5). */
  onEdit: () => void;
}) {
  const A = L.actions;
  const blocked = actions.confirmBlocked;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.editInputs && (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen("editInputs")}>
          {A.editInputs}
        </Button>
      )}
      {actions.editPlacements && (
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          {UI_LABELS.loadPlan.editor.open}
        </Button>
      )}
      {actions.calculate && (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen("calculate")}>
          {A.calculate}
        </Button>
      )}
      {actions.acknowledge && (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen("acknowledge")}>
          {A.acknowledge}
        </Button>
      )}
      {actions.reopen && (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen("reopen")}>
          {A.reopen}
        </Button>
      )}
      {actions.cancel && (
        <Button type="button" size="sm" variant="outline" onClick={() => onOpen("cancel")}>
          {A.cancel}
        </Button>
      )}
      {actions.confirm &&
        (blocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button type="button" size="sm" disabled className={PRIMARY}>
                  {A.confirm}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{BLOCK_TEXT[blocked]}</TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" size="sm" className={PRIMARY} onClick={() => onOpen("confirm")}>
            {A.confirm}
          </Button>
        ))}
    </div>
  );
}
