"use client";

import { useState } from "react";

import { PRODUCTION_LABELS } from "@/constants";

import { hasMutatingAction } from "@/features/production-order/lifecycle";

import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { ProductionOrderEditDialog } from "../edit/ProductionOrderEditDialog";
import { ProductionStatusDot } from "../parts";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { ExpectedDateDialog } from "./ExpectedDateDialog";

import type { ProductionOrderActions } from "@/features/production-order/lifecycle";
import type { ProductionOrder } from "@/features/production-order/types";
import type { ConfirmActionKind } from "./ConfirmActionDialog";
import type { ExpectedDateMode } from "./ExpectedDateDialog";

const A = PRODUCTION_LABELS.actions;

type Dialog =
  | { kind: "confirm"; action: ConfirmActionKind }
  | { kind: "date"; mode: ExpectedDateMode }
  | { kind: "edit" };

interface ButtonSpec {
  key: keyof ProductionOrderActions;
  label: string;
  dialog: Dialog;
  tone: keyof typeof DETAIL_ACTION_CLASS;
}

/** Thứ tự nút: hành động chính trước, huỷ / đóng cuối (docs 17 §5.3, brief BE §3.2). */
const BUTTONS: ButtonSpec[] = [
  // BR-23 (docs 17 §6, chốt lại 2026-11-20): gửi thẳng, không qua duyệt
  { key: "send", label: A.send, dialog: { kind: "confirm", action: "send" }, tone: "primary" },
  { key: "accept", label: A.accept, dialog: { kind: "date", mode: "accept" }, tone: "primary" },
  {
    key: "startProduction",
    label: A.startProduction,
    dialog: { kind: "date", mode: "start" },
    tone: "primary",
  },
  { key: "edit", label: A.edit, dialog: { kind: "edit" }, tone: "outline" },
  {
    key: "changeExpected",
    label: A.changeExpected,
    dialog: { kind: "date", mode: "expected" },
    tone: "outline",
  },
  { key: "close", label: A.close, dialog: { kind: "confirm", action: "close" }, tone: "danger" },
  { key: "cancel", label: A.cancel, dialog: { kind: "confirm", action: "cancel" }, tone: "danger" },
];

/**
 * Thẻ trạng thái + nút thao tác ở cột phải. Nút đến từ `productionOrderActions` (lifecycle) — không rải if/else theo
 * trạng thái trong JSX. Terminal → không có nút nào (docs 17 §5.3).
 */
export function ActionsCard({
  order,
  actions,
}: {
  order: ProductionOrder;
  actions: ProductionOrderActions;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const visible = BUTTONS.filter((button) => actions[button.key]);
  const close = () => setDialog(null);

  return (
    <section className={DETAIL_CARD_CLASS} aria-label={A.title}>
      <DetailCardTitle>
        <ProductionStatusDot status={order.status} size="md" />
      </DetailCardTitle>
      {hasMutatingAction(actions) && (
        <div className="flex flex-col gap-2">
          {visible.map((button) => (
            <Button
              key={button.key}
              type="button"
              variant={
                button.tone === "primary"
                  ? "default"
                  : button.tone === "danger"
                    ? "ghost"
                    : "outline"
              }
              className={DETAIL_ACTION_CLASS[button.tone]}
              onClick={() => setDialog(button.dialog)}
            >
              {button.label}
            </Button>
          ))}
        </div>
      )}
      {actions.startBlockedBySample && (
        <p className="text-ink-secondary mt-2 text-xs">{A.sampleBlocksStart}</p>
      )}
      {dialog?.kind === "confirm" && (
        <ConfirmActionDialog kind={dialog.action} order={order} onClose={close} />
      )}
      {dialog?.kind === "date" && (
        <ExpectedDateDialog mode={dialog.mode} order={order} onClose={close} />
      )}
      {dialog?.kind === "edit" && <ProductionOrderEditDialog order={order} onClose={close} />}
    </section>
  );
}
