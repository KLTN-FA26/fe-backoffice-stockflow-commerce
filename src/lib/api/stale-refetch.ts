import { useQueryClient } from "@tanstack/react-query";

import type { QueryKey } from "@tanstack/react-query";
import type { createMutation } from "./query-factory";

/** Hook do `createMutation` sinh ra (hoặc hook bọc nó cùng chữ ký). */
export type MutationHook<TInput, TResult> = ReturnType<typeof createMutation<TInput, TResult>>;

/** Khoá cần tải lại: cố định, hoặc tính từ biến của lần gọi (vd chi tiết đúng bản ghi). */
export type StaleKeys<TInput> = readonly QueryKey[] | ((variables: TInput) => readonly QueryKey[]);

/**
 * Bọc một mutation hook: lỗi do dữ liệu trên màn đã cũ (`isStale`, vd OPTIMISTIC_LOCK / *_NOT_FOUND /
 * chuyển trạng thái không còn hợp lệ) → tải lại các khoá liên quan rồi mới gọi `onError` của màn
 * hình, để câu "Dữ liệu đã được tải lại" là thật và lần thử sau gửi đúng `version` / trạng thái.
 * Invalidate nằm ở tầng mutation (api-conventions §2.3), component không tự gọi lại.
 */
export function withStaleRefetch<TInput, TResult>(
  useBase: MutationHook<TInput, TResult>,
  staleKeys: StaleKeys<TInput>,
  isStale: (error: unknown) => boolean,
): MutationHook<TInput, TResult> {
  return function useWithStaleRefetch(options) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        const [error, variables] = args;
        if (isStale(error)) {
          const keys = typeof staleKeys === "function" ? staleKeys(variables) : staleKeys;
          for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
        }
        options?.onError?.(...args);
      },
    });
  };
}
