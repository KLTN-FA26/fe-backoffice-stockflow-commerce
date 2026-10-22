"use client";

import { useQueryClient } from "@tanstack/react-query";

import { isStaleApiError } from "./error-message";

import type { QueryKey } from "@tanstack/react-query";
import type { createMutation } from "./query-factory";

/** Hook do `createMutation` sinh ra (hoặc hook bọc nó cùng chữ ký). */
export type MutationHook<TInput, TResult> = ReturnType<typeof createMutation<TInput, TResult>>;

/** Khoá cần tải lại: cố định, hoặc tính từ biến của lần gọi (vd chi tiết đúng bản ghi). */
export type StaleKeys<TInput> = readonly QueryKey[] | ((variables: TInput) => readonly QueryKey[]);

/**
 * Lỗi dữ liệu cũ: tải lại query liên quan trước khi gọi onError của màn hình.
 * Mặc định dùng mã lỗi chung; module có thể bổ sung mã hoặc truyền predicate riêng.
 */
export function withStaleRefetch<TInput, TResult>(
  useBase: MutationHook<TInput, TResult>,
  staleKeys: StaleKeys<TInput>,
  staleRule?: ((error: unknown) => boolean) | readonly string[],
): MutationHook<TInput, TResult> {
  return function useWithStaleRefetch(options) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onError: (...args) => {
        const [error, variables] = args;
        const isStale =
          typeof staleRule === "function"
            ? staleRule(error)
            : isStaleApiError(error, staleRule ?? []);
        if (isStale) {
          const keys = typeof staleKeys === "function" ? staleKeys(variables) : staleKeys;
          for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
        }
        options?.onError?.(...args);
      },
    });
  };
}
