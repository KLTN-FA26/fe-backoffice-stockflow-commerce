"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { ConfirmBlock, LoadPlanActions } from "@/features/load-planning/lifecycle";

const L = UI_LABELS.loadPlan.detail;
const CC = UI_LABELS.shipping.ftl.controlledCancel;
const BLOCK_TEXT: Record<ConfirmBlock, string> = L.confirmBlocked;

export type PlanDialogKind =
  | "calculate"
  | "acknowledge"
  | "confirm"
  | "reopen"
  | "cancel"
  | "cancelControlled"
  | "editInputs"
  | "removeShipment";

const PRIMARY = "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse";

interface MenuItem {
  key: string;
  label: string;
  /** Lý do đang tắt, hiện ngay dưới tên. */
  disabledReason?: string;
  run?: () => void;
}

/**
 * Nút thao tác theo `loadPlanActions` (trạng thái + quyền `:UPDATE`): terminal state không có nút. MỘT nút chính — chốt
 * kế hoạch khi chốt được, không thì tính xếp xe — còn lại nằm trong menu `…` (S16-4: đầu trang không còn sáu nút cùng cỡ).
 * Nút chốt luôn hiện khi đúng trạng thái nhưng khoá, và lý do (kèm cách gỡ) nằm ngay dưới nút chứ không chỉ khi rê chuột
 * (R7, FE#294 U54).
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
  const [menuOpen, setMenuOpen] = useState(false);
  const blocked = actions.confirmBlocked;
  const primary: "confirm" | "calculate" | null = actions.confirm
    ? "confirm"
    : actions.calculate
      ? "calculate"
      : null;
  const open = (kind: PlanDialogKind) => () => onOpen(kind);
  const items: (MenuItem | false)[] = [
    actions.editInputs && { key: "editInputs", label: A.editInputs, run: open("editInputs") },
    actions.removeShipment && {
      key: "removeShipment",
      label: A.removeShipment,
      run: open("removeShipment"),
    },
    actions.editPlacements && {
      key: "editPlacements",
      label: UI_LABELS.loadPlan.editor.open,
      run: onEdit,
    },
    actions.calculate &&
      primary !== "calculate" && {
        key: "calculate",
        label: A.calculate,
        run: open("calculate"),
      },
    actions.acknowledge && { key: "acknowledge", label: A.acknowledge, run: open("acknowledge") },
    actions.reopen && { key: "reopen", label: A.reopen, run: open("reopen") },
    actions.cancel && { key: "cancel", label: A.cancel, run: open("cancel") },
    actions.cancelControlled && {
      key: "cancelControlled",
      label: CC.cancelButton,
      ...(actions.cancelControlledBlocked
        ? { disabledReason: CC.plan.disabledVehicleLeft }
        : { run: open("cancelControlled") }),
    },
  ];
  const menu = items.filter((item): item is MenuItem => item !== false);
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {primary === "confirm" && (
          <Button
            type="button"
            size="sm"
            className={PRIMARY}
            disabled={!!blocked}
            onClick={() => onOpen("confirm")}
          >
            {A.confirm}
          </Button>
        )}
        {primary === "calculate" && (
          <Button type="button" size="sm" className={PRIMARY} onClick={() => onOpen("calculate")}>
            {A.calculate}
          </Button>
        )}
        {menu.length > 0 && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" aria-label={A.more}>
                <MoreHorizontal className="size-3.5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-60 flex-col gap-0.5 p-1">
              {menu.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  // Tên chỉ là nhãn; lý do khoá đọc qua mô tả (không lẫn vào tên nút)
                  aria-label={item.label}
                  aria-describedby={item.disabledReason ? `plan-menu-${item.key}-why` : undefined}
                  disabled={!item.run}
                  onClick={() => {
                    setMenuOpen(false);
                    item.run?.();
                  }}
                  className="hover:bg-bg-muted text-ink-primary flex flex-col items-start rounded-[var(--r-sm)] px-2.5 py-1.5 text-left text-[0.8125rem] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{item.label}</span>
                  {item.disabledReason && (
                    <span id={`plan-menu-${item.key}-why`} className="text-ink-tertiary text-xs">
                      {item.disabledReason}
                    </span>
                  )}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {primary === "confirm" && blocked && (
        <p className="text-ink-secondary max-w-sm text-right text-xs">
          {BLOCK_TEXT[blocked]}
          {blocked === "unplacedPending" && actions.acknowledge && (
            <>
              {" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => onOpen("acknowledge")}
              >
                {A.acknowledge}
              </Button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
