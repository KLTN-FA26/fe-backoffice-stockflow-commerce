import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { putawayConfirmError } from "@/features/putaway/errors";
import { useConfirmPutaway } from "@/features/putaway/mutations";
import { putawayConfirmInputSchema } from "@/features/putaway/schemas";
import { toast } from "@/components/shared/Toast";

import type { PutawayField } from "@/features/putaway/errors";
import type {
  PutawayConfirmFormValues,
  PutawayConfirmValues,
  PutawayTask,
} from "@/features/putaway/types";

const EMPTY: PutawayConfirmFormValues = { lpn: "", locationCode: "" };

/**
 * Form cất một thùng (BE `POST /putaway-tasks/{id}/confirmations`, docs 05 §4.4): quét LPN rồi quét bin — không có
 * số lượng (BR-08). zod chỉ kiểm định dạng; đúng thùng / bin nhận được do BE quyết, lỗi gắn về đúng ô
 * (`putawayConfirmError`). Nhiệm vụ đã đổi ở nơi khác → toast + `onStale` để màn tải lại. `Idempotency-Key` theo nội
 * dung: gửi lại đúng nội dung dùng lại key, sửa nội dung thì key mới.
 */
export function usePutawayConfirm({
  task,
  onFieldError,
  onStale,
}: {
  task: PutawayTask;
  onFieldError?: (field: PutawayField) => void;
  onStale?: () => void;
}) {
  const confirm = useConfirmPutaway();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [banner, setBanner] = useState<string | null>(null);
  const [alternative, setAlternative] = useState<string | null>(null);
  const form = useForm<PutawayConfirmFormValues, unknown, PutawayConfirmValues>({
    resolver: zodResolver(putawayConfirmInputSchema),
    defaultValues: EMPTY,
  });

  const submit = form.handleSubmit((values) => {
    // Chặn gửi chồng (Enter + bấm nút cùng lúc, máy quét gửi Enter hai lần)
    if (confirm.isPending) return;
    setBanner(null);
    setAlternative(null);
    const idempotencyKey = attempt.keyFor({ taskId: task.id, ...values });
    confirm.mutate(
      { taskId: task.id, values, idempotencyKey },
      {
        onSuccess: () => {
          attempt.reset();
          form.reset(EMPTY);
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = putawayConfirmError(error, task.lpn);
          if (result.stale) {
            toast.error(result.message);
            onStale?.();
          } else if (result.field) {
            form.setError(result.field, { type: "server", message: result.message });
            setAlternative(result.alternative ?? null);
            onFieldError?.(result.field);
          } else {
            setBanner(result.message);
          }
        },
      },
    );
  });

  /** Chọn bin từ danh sách gợi ý / bin BE đề nghị — điền ô bin, xoá lỗi cũ của ô. */
  const chooseBin = (code: string) => {
    form.setValue("locationCode", code, { shouldDirty: true });
    form.clearErrors("locationCode");
    setAlternative(null);
  };

  return { form, submit, pending: confirm.isPending, banner, alternative, chooseBin };
}

export type PutawayConfirmState = ReturnType<typeof usePutawayConfirm>;
