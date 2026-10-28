import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { ApiError } from "@/lib/api/error";
import { confirmLineError } from "@/features/fulfillment/pick-line-errors";
import { useConfirmPickLine } from "@/features/fulfillment/pick-line-mutations";
import { confirmPickInputSchema } from "@/features/fulfillment/pick-line-schemas";
import { toast } from "@/components/shared/Toast";

import type { ConfirmField } from "@/features/fulfillment/pick-line-errors";
import type {
  ConfirmPickFormValues,
  ConfirmPickValues,
  PickLine,
} from "@/features/fulfillment/types";

export const EMPTY_CONFIRM: ConfirmPickFormValues = {
  locationCode: "",
  scannedCode: "",
  quantity: "",
};

/**
 * Form xác nhận một dòng (BE `POST …/pick-lines/{lineId}/confirmation`): react-hook-form + zod chỉ kiểm
 * định dạng; đúng / sai so với dòng do BE quyết, lỗi 409 gắn về đúng ô (`confirmLineError`). Dòng / task đã
 * đổi ở nơi khác → toast, dữ liệu tự tải lại (`withStaleRefetch`). `Idempotency-Key` theo nội dung: gửi lại
 * đúng nội dung (sau mất mạng / BE nhả claim) dùng lại key, sửa nội dung thì key mới.
 */
export function usePickLineConfirm({
  taskId,
  line,
  onConfirmed,
  onFieldError,
}: {
  taskId: string;
  line: PickLine;
  onConfirmed: (line: PickLine) => void;
  /** BE trả lỗi gắn với một ô (sai vị trí / mã hàng / SL) — màn đưa con trỏ về ô đó. */
  onFieldError?: (field: ConfirmField) => void;
}) {
  const confirm = useConfirmPickLine();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [banner, setBanner] = useState<string | null>(null);
  const form = useForm<ConfirmPickFormValues, unknown, ConfirmPickValues>({
    resolver: zodResolver(confirmPickInputSchema),
    defaultValues: EMPTY_CONFIRM,
  });

  const submit = form.handleSubmit((values) => {
    // Chặn gửi chồng khi lần trước chưa xong (Enter + bấm nút cùng lúc)
    if (confirm.isPending) return;
    setBanner(null);
    const idempotencyKey = attempt.keyFor({ lineId: line.lineId, ...values });
    confirm.mutate(
      { taskId, lineId: line.lineId, values, idempotencyKey },
      {
        onSuccess: () => {
          attempt.reset();
          onConfirmed(line);
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = confirmLineError(error, line);
          if (result.field) {
            // Sai vị trí → xoá ô để chọn lại; các ô khác giữ nguyên
            if (result.field === "locationCode") form.setValue("locationCode", "");
            form.setError(result.field, { type: "server", message: result.message });
            onFieldError?.(result.field);
          } else if (result.stale) {
            toast.error(result.message);
          } else {
            setBanner(result.message);
          }
        },
      },
    );
  });

  return { form, submit, pending: confirm.isPending, banner };
}
