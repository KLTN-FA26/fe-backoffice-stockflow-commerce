/**
 * Sale phụ trách của MỘT khách (hợp đồng API BE-A): đọc để sửa, đổi, lịch sử. Ở `lib/references` vì trang khách
 * (`features/customer`) và màn "Phân công khách" (`features/sales-owner`, giao nhanh khách cần giao) cùng dùng, không
 * import chéo feature. Khoá query nằm dưới root `customers` → mọi thao tác làm mới khách cũng làm mới phần này.
 *
 * Hai cách đọc cùng một endpoint, hai khoá: ở đây bản ghi ĐỂ SỬA (`version` bắt buộc — thiếu thì không đổi được);
 * `sales-owner-queries.ts` đọc lỏng để chặn nút ở báo giá / hợp đồng / chat (`version` vắng vẫn dùng được). Cùng một schema
 * gốc (`salesOwnerSchema`) và cùng câu lỗi (`salesOwnerErrorMessage`); đổi người phụ trách làm mới root `customers` nên
 * cả hai khoá tải lại.
 *
 * Endpoint mới trả 400 / 403 / 404 (BE chưa có, không quyền) → `null`: màn hình ẩn thẻ / tab, không vỡ trang.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  SALES_OWNER_API,
  SALES_OWNER_CHANGE_REASONS,
  SALES_OWNER_STATES,
} from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { serverErrorMessage } from "@/lib/api/error-message";
import { bePageSchema } from "@/lib/api/page-schema";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { salesOwnerErrorMessage, salesOwnerSchema } from "./sales-owner-access";
import { orUnavailable, salesWorkloadKeys } from "./sales-workload";

import type { SalesOwnerChangeReason } from "@/constants/sales-owner";

/** Trạng thái / lý do lạ (BE thêm giá trị sau) → `null`, không làm hỏng cả bản ghi. */
const ownerState = z.enum(SALES_OWNER_STATES).nullish().catch(null);
const changeReason = z.enum(SALES_OWNER_CHANGE_REASONS).nullish().catch(null);

/**
 * Bản ghi để sửa: schema gốc chặt thêm `customerId`, `state` (enum) và `version`. NEEDS_ASSIGNMENT: người cũ (tài khoản
 * đã khoá) vẫn được giữ để biết lịch sử.
 */
export const salesOwnerDetailSchema = salesOwnerSchema.extend({
  customerId: z.string(),
  state: ownerState,
  version: z.number().int(),
});
export type SalesOwnerDetail = z.infer<typeof salesOwnerDetailSchema>;

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

export const salesOwnerKeys = {
  one: (customerId: string) => [...QUERY_ROOTS.customers, "sales-owner", customerId] as const,
  history: (customerId: string, page: number, size: number) =>
    [...QUERY_ROOTS.customers, "sales-owner-history", customerId, page, size] as const,
};

export function getSalesOwnerDetail(customerId: string, signal?: AbortSignal) {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(SALES_OWNER_API.owner(customerId), { signal });
    return salesOwnerDetailSchema.parse(data);
  });
}

export function getSalesOwnerHistory(
  customerId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
) {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(SALES_OWNER_API.history(customerId), {
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
  const { data } = await api.put<unknown>(SALES_OWNER_API.owner(customerId), {
    ...body,
    note: body.note.trim(),
  });
  return salesOwnerDetailSchema.safeParse(data).data ?? null;
}

export function useSalesOwnerDetail(customerId: string, enabled = true) {
  return useQuery({
    queryKey: salesOwnerKeys.one(customerId),
    queryFn: ({ signal }) => getSalesOwnerDetail(customerId, signal),
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

/**
 * Đổi người phụ trách: làm mới root `customers` — thẻ, lịch sử, danh sách VÀ khoá đọc lỏng của chế độ chặt
 * (`salesOwnerAccessKeys`, cũng dưới root này) để nút báo giá / hợp đồng / chat mở hay khoá theo người mới — cùng bảng tải
 * và danh sách Sale giao được. Lỗi hiện trong hộp thoại.
 */
export const useChangeSalesOwner = withStaleRefetch(
  createMutation<ChangeSalesOwnerInput, SalesOwnerDetail | null>(changeSalesOwner, {
    invalidate: [QUERY_ROOTS.customers, salesWorkloadKeys.all],
    successMessage: "Đã đổi người phụ trách.",
    showErrorToast: false,
  }),
  [QUERY_ROOTS.customers],
  SALES_OWNER_STALE_CODES,
);

/**
 * Mã lỗi của thao tác ĐỔI người phụ trách (hợp đồng §Error codes) → câu tiếng Việt. Riêng cho đổi / chuyển / quyết yêu
 * cầu: `OPTIMISTIC_LOCK`, `FORBIDDEN` ở đây nói về người phụ trách, nên không dùng cho báo giá / hợp đồng.
 */
export const OWNER_CHANGE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
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

/**
 * Lỗi của thao tác đổi người phụ trách: hai lỗi chế độ chặt (nêu tên người phụ trách) qua `salesOwnerErrorMessage` — một
 * chỗ duy nhất cho mọi màn —, còn lại theo `messages` (mặc định `OWNER_CHANGE_ERROR_MESSAGES`) rồi câu của BE.
 */
export function ownerChangeErrorMessage(
  error: unknown,
  messages: Readonly<Record<string, string>> = OWNER_CHANGE_ERROR_MESSAGES,
): string {
  return salesOwnerErrorMessage(error) ?? serverErrorMessage(error, messages);
}
