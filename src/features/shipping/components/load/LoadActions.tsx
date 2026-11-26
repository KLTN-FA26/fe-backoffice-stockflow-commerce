"use client";

import Link from "next/link";
import { ClipboardList, ShieldAlert, Truck } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { hasLoadAction } from "@/features/shipping/lifecycle";
import { loadingSheetOf } from "@/features/shipping/loading-sheet-lifecycle";
import { Button } from "@/components/ui/button";

import { HandoverMissing } from "./HandoverMissing";
import { LoadingSheetButton } from "./LoadingSheetButton";
import { useShippingActor } from "../useShippingActor";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";

const A = UI_LABELS.shipping.load.actions;
const CC = UI_LABELS.shipping.ftl.controlledCancel;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

/**
 * Nút hành động chính (góc phải-trên, mode-a §4.3): biên bản (xem / in), huỷ có kiểm soát, xác nhận bàn giao.
 * Gate theo `allowedLoadActions` (quyền + vai trò + trạng thái) — không rải if/else trong JSX.
 */
export function LoadActions({
  load,
  actions,
  onHandover,
  onControlledCancel,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  onHandover: () => void;
  /** Huỷ có kiểm soát một xe đang xếp hàng (SCRUM-474) — chỉ khi có quyền của quản lý kho. */
  onControlledCancel: () => void;
}) {
  const handover = hasLoadAction(actions, "handover");
  const controlledCancel = hasLoadAction(actions, "controlledCancel");
  const sheet = loadingSheetOf(load, useShippingActor());
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {controlledCancel && (
          <Button variant="outline" size="sm" onClick={onControlledCancel}>
            <ShieldAlert className="size-3.5" /> {CC.cancelButton}
          </Button>
        )}
        {sheet && <LoadingSheetButton {...sheet} />}
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.loads.manifest(load.loadId)}>
            <ClipboardList className="size-3.5" /> {A.manifest}
          </Link>
        </Button>
        {handover && (
          <Button
            size="sm"
            className={PRIMARY}
            disabled={!!handover.disabledReason}
            title={handover.disabledReason}
            onClick={onHandover}
          >
            <Truck className="size-3.5" /> {A.handover}
          </Button>
        )}
      </div>
      {/* R7: vì sao nút khoá, nói ngay dưới nút chứ không chỉ ở `title` (S18-1, FE#291 U45 / U82) */}
      {handover?.disabledReason && <HandoverMissing load={load} />}
    </div>
  );
}
