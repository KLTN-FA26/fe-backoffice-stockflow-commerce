"use client";

import { CalendarClock } from "lucide-react";

import { WINDOW_CHANGE_LABELS } from "@/constants";
import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { useChangeDeliveryWindow } from "../../delivery-window-mutations";
import { usePendingSafeDialog } from "../usePendingSafeDialog";

import { WindowChangeForm } from "./WindowChangeForm";

import type { DeliveryBatch } from "../../delivery-batch-api";

interface DeliveryWindowActionProps {
  order: { orderId: string; orderNumber: string };
  batch: DeliveryBatch;
  batches: readonly DeliveryBatch[];
}

/**
 * Nút "Dời cửa sổ giao" của một đợt + hộp thoại (docs 17 §4.5, BR-28). Hiện khi người dùng có
 * `sales-contracts:UPDATE` (Sale) và đợt chưa có thùng nào bàn giao (`isWindowMovable`) — UI-only, Backend phải re-check
 * (409 DELIVERY_BATCH_WINDOW_LOCKED). Mutation ở đây (không ở form) để Esc / bấm ra ngoài không đóng hộp thoại khi đang
 * gửi, giữ lần thử Idempotency-Key.
 */
export function DeliveryWindowAction({ order, batch, batches }: DeliveryWindowActionProps) {
  const mutation = useChangeDeliveryWindow();
  const dialog = usePendingSafeDialog(mutation.isPending);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className="border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)] border px-2.5 py-1 text-xs font-medium"
      >
        <CalendarClock className="size-3.5" /> {WINDOW_CHANGE_LABELS.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <WindowChangeForm
          order={order}
          batch={batch}
          batches={batches}
          mutation={mutation}
          onClose={dialog.close}
        />
      </FormDialog>
    </>
  );
}
