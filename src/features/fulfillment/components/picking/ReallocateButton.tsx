"use client";

import { useState } from "react";

import { PICK_LINE_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { isStaleFulfillmentError } from "@/features/fulfillment/errors";
import { reallocateError } from "@/features/fulfillment/pick-line-errors";
import { useReallocateShortLine } from "@/features/fulfillment/pick-line-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { PickLine } from "@/features/fulfillment/types";

const L = PICK_LINE_LABELS;

/**
 * Phân bổ lại một dòng SHORT (X-SHORT bước 04, BE `POST …/reallocation`): cùng SL sang bin khác còn hàng,
 * dòng cũ → Đã huỷ, dòng mới ở cuối lộ trình. Người gọi chỉ render nút khi có `task-assignment:UPDATE`.
 * Không đủ hàng (409 INSUFFICIENT_STOCK) báo trong dialog; dòng đã đổi ở nơi khác → toast + tải lại.
 */
export function ReallocateButton({
  taskId,
  line,
  onReallocated,
}: {
  taskId: string;
  line: PickLine;
  /** Phân bổ lại xong — màn bỏ câu "Đã lấy dòng …" của lần xác nhận trước. */
  onReallocated?: () => void;
}) {
  const reallocate = useReallocateShortLine();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (reallocate.isPending) return;
    setError(null);
    reallocate.mutate(
      { taskId, lineId: line.lineId, idempotencyKey: attempt.keyFor({ lineId: line.lineId }) },
      {
        onSuccess: () => {
          attempt.reset();
          setOpen(false);
          onReallocated?.();
        },
        onError: (err) => {
          if (err instanceof ApiError) attempt.settle(err);
          else attempt.reset();
          if (isStaleFulfillmentError(err)) {
            toast.error(reallocateError(err));
            setOpen(false);
          } else {
            setError(reallocateError(err));
          }
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-label={L.reallocateLine(line.sequenceNo)}
        onClick={() => setOpen(true)}
        className="border-border-default rounded-[var(--r-sm)]"
      >
        {L.reallocate}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={L.reallocate}
        // BE phân bổ lại TOÀN BỘ SL đã giữ của dòng (`shortHold.quantity()`), không chỉ phần thiếu
        description={L.reallocateConfirm(line.sku, line.allocatedQty)}
        confirmLabel={L.reallocate}
        variant="default"
        loading={reallocate.isPending}
        closeOnConfirm={false}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
}
