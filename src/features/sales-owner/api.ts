/**
 * Phân công khách — API (hợp đồng sales-owner BE-A, BE-B). Parse tại biên. Endpoint mới trả 400 / 403 / 404 → `null`
 * ("chưa dùng được"): màn hình ẩn phần đó, không vỡ trang.
 */

import { z } from "zod";

import { SALES_OWNER_STATES } from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { isUnavailableError } from "@/lib/references/sales-workload";

import {
  assignmentSettingsSchema,
  chatWorkloadSchema,
  pageOf,
  transferBatchListSchema,
  transferResultSchema,
} from "./schemas";

import type { SalesOwnerChangeReason, SalesOwnerState } from "@/constants/sales-owner";
import type { ChatWorkloadRow, TransferBatch, TransferResult } from "./types";

const TRANSFERS = "/customers/sales-owner-transfers";

export async function orUnavailable<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableError(error)) return null;
    throw error;
  }
}

/** BE-B `GET /chat/agents/workload` — hội thoại mở / trễ hạn theo Sale; ghép vào bảng tải theo `userId`. */
export function listChatWorkload(signal?: AbortSignal): Promise<ChatWorkloadRow[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>("/chat/agents/workload", { signal });
    return chatWorkloadSchema.parse(data);
  });
}

export interface TransferRequest {
  /** Khoá chống chạy lại: sinh MỘT lần mỗi lần mở hộp thoại (BR-S09 "chạy lại không bị nhân đôi"). */
  requestId: string;
  fromUserId: string;
  toUserIds: string[];
  /** Vắng = mọi khách đang thuộc Sale A lúc chạy. */
  customerIds?: string[];
  reason: SalesOwnerChangeReason;
  note: string;
  temporary: boolean;
  notifyCustomer: boolean;
}

/** `POST /customers/sales-owner-transfers` — nhiều Sale nhận thì BE chia đều; khách đã đổi tay giữa chừng bị bỏ qua. */
export async function transferCustomers(body: TransferRequest): Promise<TransferResult> {
  const { data } = await api.post<unknown>(TRANSFERS, body);
  return transferResultSchema.parse(data ?? {});
}

/** `POST …/{batchId}/return` (§10.1): trả khách của lô tạm còn ở người nhận về người cũ. */
export async function returnTransferBatch(batchId: string): Promise<TransferResult> {
  const { data } = await api.post<unknown>(`${TRANSFERS}/${encodeURIComponent(batchId)}/return`);
  return transferResultSchema.parse(data ?? {});
}

/**
 * Lô chuyển tạm còn trả được — ĐỀ XUẤT thêm vào hợp đồng (`GET /customers/sales-owner-transfers?temporary=true`): hợp
 * đồng có trả lô nhưng chưa có cách liệt kê lô. BE chưa có → `null`, phần "Lô chuyển tạm" ẩn.
 */
export function listTemporaryBatches(signal?: AbortSignal): Promise<TransferBatch[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(TRANSFERS, { params: { temporary: true }, signal });
    return transferBatchListSchema.parse(data);
  });
}

export async function saveAssignmentSettings(input: {
  userId: string;
  paused: boolean;
  capacityPerMonth: number | null;
}) {
  const { userId, ...body } = input;
  const { data } = await api.put<unknown>(
    `/sales/staff/${encodeURIComponent(userId)}/assignment-settings`,
    body,
  );
  return assignmentSettingsSchema.safeParse(data).data ?? null;
}

/** Dòng khách tối thiểu cho các danh sách của màn phân công (cùng `GET /customers`). */
const ownedCustomerSchema = z.object({
  customerId: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  salesOwnerId: z.string().nullish(),
  salesOwnerName: z.string().nullish(),
  salesOwnerState: z.enum(SALES_OWNER_STATES).nullish().catch(null),
  salesOwnerSince: z.string().nullish(),
});
const ownedCustomerPageSchema = pageOf(ownedCustomerSchema);
export type OwnedCustomer = z.infer<typeof ownedCustomerSchema>;

/** Khách đang thuộc một Sale (chọn một phần khách để chuyển) — tối đa 200 (BE `Pages.MAX_PAGE_SIZE`). */
export async function listCustomersOf(userId: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/customers", {
    params: new URLSearchParams({
      salesOwnerId: userId,
      page: "0",
      size: "200",
      sort: "fullName,asc",
    }),
    signal,
  });
  return ownedCustomerPageSchema.parse(data);
}

/** Khách chưa có người phụ trách: "Cần giao" (người cũ nghỉ) hoặc "Chưa có" (chưa từng có ai). */
export async function listUnownedCustomers(
  params: { state: Exclude<SalesOwnerState, "ASSIGNED">; page: number; size: number },
  signal?: AbortSignal,
) {
  const { data } = await api.get<unknown>("/customers", {
    params: new URLSearchParams({
      salesOwnerState: params.state,
      page: String(params.page),
      size: String(params.size),
    }),
    signal,
  });
  return ownedCustomerPageSchema.parse(data);
}
