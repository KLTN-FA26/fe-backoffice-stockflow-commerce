"use client";

import { useState } from "react";
import { CircleSlash, PackageCheck } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { Button } from "@/components/ui/button";

import { returnErrorMessage } from "../errors";
import { useCloseWithoutRefund, useMarkGoodsComplete } from "../mutations";

import { NoteConfirmDialog } from "./NoteConfirmDialog";

import type { ReturnAction } from "../lifecycle";
import type { ReturnRequest } from "../types";

const A = RETURN_LABELS.actions;
type Open = "goodsComplete" | "closeWithoutRefund" | null;

/**
 * Chốt hàng về của Sale (WF-05): "Đã nhận đủ hàng" khi về thiếu mà khách không gửi thêm (TH-3, AWAITING_RETURN có ≥ 1
 * kiện về) và "Kết thúc không hoàn tiền" khi không đơn vị nào đã duyệt về dùng được (TH-4, RECEIVED). Nút đã lọc qua
 * `allowedReturnActions`; Backend phải re-check (`sales-rma-resolutions:UPDATE`).
 */
export function ReturnGoodsActions({
  ret,
  actions,
}: {
  ret: ReturnRequest;
  actions: readonly ReturnAction[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const goodsComplete = useMarkGoodsComplete();
  const closeWithoutRefund = useCloseWithoutRefund();
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const handlers = { onSuccess: close, onError: (e: unknown) => setError(returnErrorMessage(e)) };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.includes("goodsComplete") && (
          <Button size="sm" onClick={() => setOpen("goodsComplete")}>
            <PackageCheck className="size-3.5" /> {A.goodsComplete}
          </Button>
        )}
        {actions.includes("closeWithoutRefund") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("closeWithoutRefund")}>
            <CircleSlash className="size-3.5" /> {A.closeWithoutRefund}
          </Button>
        )}
      </div>
      <NoteConfirmDialog
        open={open === "goodsComplete"}
        onClose={close}
        {...dialogCopy(RETURN_LABELS.goodsCompleteDialog)}
        noteMax={RETURN_LIMITS.goodsCompleteNoteMax}
        loading={goodsComplete.isPending}
        error={error}
        onConfirm={(note) =>
          goodsComplete.mutate({ id: ret.id, version: ret.version, note }, handlers)
        }
      />
      <NoteConfirmDialog
        open={open === "closeWithoutRefund"}
        onClose={close}
        {...dialogCopy(RETURN_LABELS.closeWithoutRefundDialog)}
        noteMax={RETURN_LIMITS.noteMax}
        loading={closeWithoutRefund.isPending}
        error={error}
        onConfirm={(note) =>
          closeWithoutRefund.mutate({ id: ret.id, version: ret.version, note }, handlers)
        }
      />
    </>
  );
}

const dialogCopy = (copy: {
  title: string;
  description: string;
  note: string;
  submit: string;
}) => ({
  title: copy.title,
  description: copy.description,
  noteLabel: copy.note,
  confirmLabel: copy.submit,
});
