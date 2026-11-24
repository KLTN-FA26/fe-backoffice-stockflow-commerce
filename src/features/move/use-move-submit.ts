import { useRef, useState } from "react";

import { isIdempotencyReused, moveErrorView, moveFieldErrors } from "./errors";
import { useCreateMove } from "./mutations";
import { useMoveRequestId } from "./use-move-request-id";

import type { UseFormReturn } from "react-hook-form";
import type { MovedCarton, MoveCreateInput } from "./types";

export interface MoveFailure {
  detail: string;
  /** Thùng BE nêu trong lỗi (`details.lpn`) — dòng đó được đánh dấu. */
  lpn?: string;
}

/**
 * Gửi lệnh chuyển: một requestId cho mỗi bộ (thùng, đích) — gửi lại sau khi mất phản hồi không chuyển hai lần; thành
 * công thì quên id và `onDone` (xoá danh sách); IDEMPOTENCY_KEY_REUSED thì quên id để lần sau mang id mới.
 */
export function useMoveSubmit(form: UseFormReturn<MoveCreateInput>, onDone: () => void) {
  const mutation = useCreateMove();
  const requestId = useMoveRequestId();
  const [result, setResult] = useState<MovedCarton[] | null>(null);
  // Kept outside the form's error state: `setError` would mark the form invalid and block a retry of an unchanged,
  // still valid move (e.g. after a lost response).
  const [failure, setFailure] = useState<MoveFailure | null>(null);
  // `mutation.isPending` is a render snapshot; this ref flips synchronously so a double click cannot send two requests.
  const submitting = useRef(false);

  const submitValid = async (input: MoveCreateInput) => {
    if (submitting.current) return;
    submitting.current = true;
    setFailure(null);
    setResult(null);
    try {
      setResult(await mutation.mutateAsync({ input, requestId: requestId.idFor(input) }));
      requestId.forget();
      onDone();
    } catch (error: unknown) {
      if (isIdempotencyReused(error)) requestId.forget();
      for (const [field, message] of Object.entries(moveFieldErrors(error))) {
        form.setError(field as keyof MoveCreateInput, { type: "server", message });
      }
      const view = moveErrorView(error);
      setFailure({ detail: view.lpn ? `${view.lpn}: ${view.detail}` : view.detail, lpn: view.lpn });
    } finally {
      submitting.current = false;
    }
  };

  return {
    submit: () => void form.handleSubmit(submitValid)(),
    isPending: mutation.isPending,
    error: mutation.error,
    result,
    failure,
    clearFailure: () => setFailure(null),
  };
}
