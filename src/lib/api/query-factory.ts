/**
 * Query & Mutation factories — reusable for standard CRUD patterns.
 *
 * Factory cho CRUD chuẩn (list, detail, create, update, delete).
 * Case phức tạp (invalidation nhiều module, optimistic update) → viết manual.
 *
 * Usage:
 *   // features/purchase-order/queries.ts
 *   const poKeys = createQueryKeys("purchase-orders");
 *   const usePurchaseOrders = createListQuery(poKeys, listPurchaseOrders);
 *   const usePurchaseOrder = createDetailQuery(poKeys, getPurchaseOrder);
 *
 *   // features/purchase-order/mutations.ts
 *   const useCreatePo = createMutation(createPurchaseOrder, {
 *     invalidate: [poKeys.all],
 *     successMessage: "Tạo đơn đặt hàng thành công",
 *   });
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
  type InvalidateQueryFilters,
} from "@tanstack/react-query";
import { QUERY_TIMES } from "./query-client";
import type { ApiError } from "./error";

/* ============================================================================
 * 1. Query Key Factory
 * ==========================================================================*/

export interface QueryKeys<TParams = Record<string, unknown>> {
  /** Root key — invalidate everything for this entity. */
  all: readonly string[];
  /** List key with filter params. */
  list: (params?: TParams) => readonly unknown[];
  /** Detail key by ID. */
  detail: (id: string) => readonly unknown[];
}

/**
 * Create a standard query key factory for an entity.
 *
 * @example
 *   const poKeys = createQueryKeys("purchase-orders");
 *   poKeys.all       // ["purchase-orders"]
 *   poKeys.list({})  // ["purchase-orders", "list", {}]
 *   poKeys.detail(id)// ["purchase-orders", "detail", id]
 */
export function createQueryKeys<TParams = Record<string, unknown>>(
  entity: string,
): QueryKeys<TParams> {
  return {
    all: [entity] as const,
    list: (params?: TParams) => [entity, "list", params] as const,
    detail: (id: string) => [entity, "detail", id] as const,
  };
}

/* ============================================================================
 * 2. List Query Factory
 * ==========================================================================*/

export interface PaginatedResponse<T> {
  items: T[];
  /** Zero-based page number, matching the backend PageResponse contract. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Temporary compatibility shape for mock-only/legacy modules that have not migrated to the
 * backend PageResponse contract yet. New backend integrations must use PaginatedResponse.
 */
export interface LegacyPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface ListQueryParams {
  page?: number; // zero-based
  size?: number;
  sort?: string;
  q?: string;
  [key: string]: unknown;
}

/**
 * Create a reusable list query hook with pagination support.
 *
 * @example
 *   const usePurchaseOrders = createListQuery(
 *     poKeys,
 *     (params, signal) => listPurchaseOrders(params, signal),
 *   );
 *
 *   // In component (canonical backend pages are zero-based):
 *   const { data, isLoading } = usePurchaseOrders({ page: 0, status: ["Draft"] });
 */
export function createListQuery<
  TItem,
  TParams extends ListQueryParams = ListQueryParams,
  TResponse extends { items: TItem[] } = PaginatedResponse<TItem>,
>(
  keys: QueryKeys<TParams>,
  fetcher: (params: TParams, signal?: AbortSignal) => Promise<TResponse>,
  defaultOptions?: Partial<UseQueryOptions<TResponse>>,
) {
  return function useListQuery(
    params: TParams,
    /** Tuỳ chọn theo từng lần gọi, vd `{ enabled: canRead }` khi thiếu quyền đọc dữ liệu. */
    options?: Pick<UseQueryOptions<TResponse>, "enabled">,
  ) {
    return useQuery<TResponse>({
      queryKey: keys.list(params) as QueryKey,
      queryFn: ({ signal }) => fetcher(params, signal),
      placeholderData: keepPreviousData, // No flash when changing filters
      ...QUERY_TIMES.list,
      ...defaultOptions,
      ...options,
    });
  };
}

/* ============================================================================
 * 3. Detail Query Factory
 * ==========================================================================*/

/**
 * Create a reusable detail query hook.
 *
 * @example
 *   const usePurchaseOrder = createDetailQuery(
 *     poKeys,
 *     (id, signal) => getPurchaseOrder(id, signal),
 *   );
 *
 *   // In component:
 *   const { data } = usePurchaseOrder(poId);
 */
export function createDetailQuery<TDetail>(
  keys: QueryKeys,
  fetcher: (id: string, signal?: AbortSignal) => Promise<TDetail>,
  defaultOptions?: Partial<UseQueryOptions<TDetail>>,
) {
  return function useDetailQuery(
    id: string | null | undefined,
    /** Tuỳ chọn theo từng lần gọi; `enabled` được AND với điều kiện có id. */
    options?: Pick<UseQueryOptions<TDetail>, "enabled">,
  ) {
    return useQuery<TDetail>({
      queryKey: keys.detail(id ?? "") as QueryKey,
      queryFn: ({ signal }) => fetcher(id!, signal),
      ...QUERY_TIMES.detail,
      ...defaultOptions,
      enabled: !!id && options?.enabled !== false,
    });
  };
}

/* ============================================================================
 * 4. Mutation Factory
 * ==========================================================================*/

export interface MutationFactoryOptions<TInput, TResult> {
  /** Query keys to invalidate on success. */
  invalidate?: readonly (readonly unknown[])[];
  /** Toast message on success. */
  successMessage?: string;
  /** Show the default error toast. Disable when a screen maps field errors inline. */
  showErrorToast?: boolean;
  /** Additional onSuccess handler. */
  onSuccess?: (data: TResult, variables: TInput) => void;
  /** Additional onError handler. */
  onError?: (error: ApiError, variables: TInput) => void;
  /** Additional options passed to useMutation. */
  options?: Partial<UseMutationOptions<TResult, ApiError, TInput>>;
}

/**
 * Create a reusable mutation hook with automatic invalidation.
 *
 * @example
 *   // Standard CRUD — factory handles invalidation + toast:
 *   const useCreatePo = createMutation(createPurchaseOrder, {
 *     invalidate: [poKeys.all],
 *     successMessage: "Tạo đơn đặt hàng thành công",
 *   });
 *
 *   // Complex cross-module invalidation — still use factory:
 *   const useConfirmReceipt = createMutation(confirmReceipt, {
 *     invalidate: [receiptKeys.all, poKeys.all, putawayKeys.all, dashboardKeys.all],
 *     successMessage: "Đã xác nhận phiếu nhận",
 *   });
 *
 *   // In component:
 *   const { mutate, isPending } = useCreatePo();
 *   mutate(formData);
 */
export function createMutation<TInput, TResult = void>(
  mutationFn: (input: TInput) => Promise<TResult>,
  factoryOpts: MutationFactoryOptions<TInput, TResult> = {},
) {
  return function useMutationHook(
    hookOpts?: Partial<UseMutationOptions<TResult, ApiError, TInput>>,
  ) {
    const queryClient = useQueryClient();

    // onSuccess/onError của hook (và của `factoryOpts.options`) được GỌI BÊN TRONG handler gộp
    // dưới đây, không spread đè lên — nếu spread sau cùng, callback màn hình sẽ thay thế
    // handler gộp và làm mất invalidate + toast của factory.
    const { onSuccess: hookOnSuccess, onError: hookOnError, ...hookRest } = hookOpts ?? {};
    const {
      onSuccess: optionsOnSuccess,
      onError: optionsOnError,
      ...optionsRest
    } = factoryOpts.options ?? {};

    return useMutation<TResult, ApiError, TInput>({
      ...optionsRest,
      ...hookRest,
      mutationFn,

      onSuccess: (data, variables, ...rest) => {
        // Invalidate specified query keys
        if (factoryOpts.invalidate) {
          for (const key of factoryOpts.invalidate) {
            queryClient.invalidateQueries({
              queryKey: key,
            } as InvalidateQueryFilters);
          }
        }

        // Toast success — dynamic require to avoid circular import
        if (factoryOpts.successMessage) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { toast } = require("@/components/shared/Toast");
            toast.success(factoryOpts.successMessage);
          } catch {
            /* Toast not available */
          }
        }

        // Custom factory-level handlers, then hook-level handler
        factoryOpts.onSuccess?.(data, variables);
        optionsOnSuccess?.(data, variables, ...rest);
        hookOnSuccess?.(data, variables, ...rest);
      },

      onError: (error, variables, ...rest) => {
        if (factoryOpts.showErrorToast !== false) {
          // Toast error — dynamic require to avoid circular import
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { toast } = require("@/components/shared/Toast");
            toast.error(error.message);
          } catch {
            /* Toast not available */
          }
        }

        // Custom factory-level handlers, then hook-level handler
        factoryOpts.onError?.(error, variables);
        optionsOnError?.(error, variables, ...rest);
        hookOnError?.(error, variables, ...rest);
      },
    });
  };
}

/* ============================================================================
 * 5. Delete Mutation Factory
 * ==========================================================================*/

/**
 * Specialised mutation for delete operations.
 * Wraps createMutation with sensible defaults (invalidate list + detail).
 */
export function createDeleteMutation<TId = string>(
  deleteFn: (id: TId) => Promise<void>,
  keys: QueryKeys,
  successMessage = "Đã xóa thành công",
) {
  return createMutation(deleteFn, {
    invalidate: [keys.all],
    successMessage,
  });
}

/* ============================================================================
 * 6. Status Transition Mutation Factory
 * ==========================================================================*/

export interface TransitionInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

/**
 * Create a mutation for status transitions with lifecycle validation.
 *
 * @example
 *   const useTransitionPo = createTransitionMutation(
 *     transitionPo,
 *     poKeys,
 *     [poKeys.all, replenishmentKeys.all], // cross-module invalidation
 *   );
 */
export function createTransitionMutation<TInput extends TransitionInput, TResult = void>(
  transitionFn: (input: TInput) => Promise<TResult>,
  keys: QueryKeys,
  additionalInvalidations: readonly (readonly unknown[])[] = [],
  successMessage?: string,
) {
  return createMutation(transitionFn, {
    invalidate: [keys.all, ...additionalInvalidations],
    successMessage,
  });
}
