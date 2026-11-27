/**
 * Sale phụ trách của MỘT khách (hợp đồng API BE-A): đọc, đổi, lịch sử. Ở `lib/references` vì trang khách
 * (`features/customer`) và màn "Phân công khách" (`features/sales-owner`, giao nhanh khách cần giao) cùng dùng, không
 * import chéo feature. Khoá query nằm dưới root `customers` → mọi thao tác làm mới khách cũng làm mới phần này.
 *
 * Endpoint mới trả 400 / 403 / 404 (BE chưa có, không quyền) → `null`: màn hình ẩn thẻ / tab, không vỡ trang.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SALES_OWNER_CHANGE_REASONS, SALES_OWNER_STATES } from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { serverErrorMessage } from "@/lib/api/error-message";
import { bePageSchema } from "@/lib/api/page-schema";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { isUnavailableError, salesWorkloadKeys } from "./sales-workload";

import type { SalesOwnerChangeReason } from "@/constants/sales-owner";

/** Trạng thái / lý do lạ (BE thêm giá trị sau) → `null`, không làm hỏng cả bản ghi. */
const ownerState = z.enum(SALES_OWNER_STATES).nullish().catch(null);
const changeReason = z.enum(SALES_OWNER_CHANGE_REASONS).nullish().catch(null);

export const salesOwnerDtoSchema = z.object({
  customerId: z.string(),
  /** NEEDS_ASSIGNMENT: người cũ (tài khoản đã khoá) vẫn được giữ để biết lịch sử. */
  salesOwnerId: z.string().nullish(),
  salesOwnerName: z.string().nullish(),
  active: z.boolean().nullish(),
  state: ownerState,
  since: z.string().nullish(),
  cover: z.object({ userId: z.string(), name: z.string(), until: z.string() }).nullish(),
  version: z.number().int(),
});
export type SalesOwner = z.infer<typeof salesOwnerDtoSchema>;

export const salesOwnerHistoryEntrySchema = z.object({
  id: z.string(),
  fromUserId: z.string().nullish(),
  fromName: z.string().nullish(),
  toUserId: z.string().nullish(),
  toName: z.string().nullish(),
  reason: changeReason,
  note: z.string().nullish(),
  changedById: z.string().nullish(),
  changedByName: z.string().nullish(),
  changedAt: z.string(),
  batchId: z.string().nullish(),
});
export const salesOwnerHistoryPageSchema = bePageSchema(salesOwnerHistoryEntrySchema);
export type SalesOwnerHistoryEntry = z.infer<typeof salesOwnerHistoryEntrySchema>;
export type SalesOwnerHistoryPage = z.infer<typeof salesOwnerHistoryPageSchema>;

const byId = (id: string) => `/customers/${encodeURIComponent(id)}`;

export const salesOwnerKeys = {
  one: (customerId: string) => [...QUERY_ROOTS.customers, "sales-owner", customerId] as const,
  history: (customerId: string, page: number, size: number) =>
    [...QUERY_ROOTS.customers, "sales-owner-history", customerId, page, size] as const,
};

async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableError(error)) return null;
    throw error;
  }
}

export function getSalesOwner(customerId: string, signal?: AbortSignal) {
  return orNull(async () => {
    const { data } = await api.get<unknown>(`${byId(customerId)}/sales-owner`, { signal });
    return salesOwnerDtoSchema.parse(data);
  });
}

export function getSalesOwnerHistory(
  customerId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
) {
  return orNull(async () => {
    const { data } = await api.get<unknown>(`${byId(customerId)}/sales-owner-history`, {
      params: { page, size },
      signal,
    });
    return salesOwnerHistoryPageSchema.parse(data);
  });
}

export interface ChangeSalesOwnerInput {
  customerId: string;
  salesOwnerId: string;
  reason: SalesOwnerChangeReason;
  note: string;
  notifyCustomer: boolean;
  /** `version` của `GET …/sales-owner` đang xem (ca #15: hai quản lý cùng đổi → người sau bị từ chối). */
  version: number;
}

/** `PUT /customers/{id}/sales-owner` (BR-S01, BR-S03). */
export async function changeSalesOwner({ customerId, ...body }: ChangeSalesOwnerInput) {
  const { data } = await api.put<unknown>(`${byId(customerId)}/sales-owner`, {
    ...body,
    note: body.note.trim(),
  });
  return salesOwnerDtoSchema.safeParse(data).data ?? null;
}

export function useSalesOwner(customerId: string, enabled = true) {
  return useQuery({
    queryKey: salesOwnerKeys.one(customerId),
    queryFn: ({ signal }) => getSalesOwner(customerId, signal),
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.detail,
  });
}

export function useSalesOwnerHistory(
  customerId: string,
  page: number,
  size: number,
  enabled = true,
) {
  return useQuery({
    queryKey: salesOwnerKeys.history(customerId, page, size),
    queryFn: ({ signal }) => getSalesOwnerHistory(customerId, page, size, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

/** Mã báo "bản đang xem đã cũ" → tải lại người phụ trách trước khi hiện lỗi (ca #15). */
export const SALES_OWNER_STALE_CODES = ["SALES_OWNER_VERSION_CONFLICT", "OPTIMISTIC_LOCK"] as const;

/** Đổi người phụ trách: làm mới khách (thẻ, lịch sử, danh sách) và bảng tải. Lỗi hiện trong hộp thoại. */
export const useChangeSalesOwner = withStaleRefetch(
  createMutation<ChangeSalesOwnerInput, SalesOwner | null>(changeSalesOwner, {
    invalidate: [QUERY_ROOTS.customers, salesWorkloadKeys.all],
    successMessage: "Đã đổi người phụ trách.",
    showErrorToast: false,
  }),
  [QUERY_ROOTS.customers],
  SALES_OWNER_STALE_CODES,
);

/** Mã lỗi hợp đồng (§Error codes) → câu tiếng Việt; `CUSTOMER_OWNED_BY_OTHER_SALES` giữ câu BE (nêu tên người). */
export const SALES_OWNER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  SALES_OWNER_NOT_ASSIGNABLE:
    "Người này không phải Sale đang làm nên không giao được. Chọn Sale khác.",
  SALES_OWNER_VERSION_CONFLICT:
    "Người khác vừa đổi người phụ trách của khách này, đã tải lại. Kiểm tra rồi làm lại.",
  OPTIMISTIC_LOCK:
    "Người khác vừa đổi người phụ trách của khách này, đã tải lại. Kiểm tra rồi làm lại.",
  SALES_OWNER_CHANGE_REASON_REQUIRED: "Chọn lý do đổi người phụ trách.",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  FORBIDDEN: "Chỉ Sales Manager hoặc quản trị viên được đổi người phụ trách.",
};

export function salesOwnerErrorMessage(error: unknown): string {
  return serverErrorMessage(error, SALES_OWNER_ERROR_MESSAGES);
}
