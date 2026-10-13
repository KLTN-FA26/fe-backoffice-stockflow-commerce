"use client";

import { useQueryClient } from "@tanstack/react-query";

import { isStaleApiError } from "./error-message";

import type { QueryKey } from "@tanstack/react-query";
import type { createMutation } from "./query-factory";

/**
 * Bọc hook mutation (mẫu `features/receipt/mutations.ts`): lỗi do dữ liệu cũ (OPTIMISTIC_LOCK,
 * CONFLICT, LOCK_TIMEOUT, mã chuyển trạng thái sai…) → tải lại các query liên quan rồi mới gọi
 * onError của màn hình, để câu báo "dữ liệu đã được tải lại" luôn đúng.
 */
export function withStaleRefetch<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
  keys: readonly QueryKey[],
  extraStaleCodes: readonly string[] = [],
) {
  return function useWithStaleRefetch(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        if (isStaleApiError(args[0], extraStaleCodes)) {
          for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
        }
        options?.onError?.(...args);
      },
    });
  };
}
