/**
 * Bảng tải Sale (kế hoạch sales-owner §10.4; hợp đồng BE-C "Workload"): `GET /sales/workload` — mỗi Sale đang làm một
 * dòng, kèm tạm dừng / sức chứa / nghỉ phép / số khách; cho bảng "Phân công khách" và gợi ý Sale còn trống nhất. Ô CHỌN
 * Sale không đọc từ đây mà từ `sales-agents.ts` (D42). Đặt ở `lib/references` để trang khách (`features/customer`) và các
 * màn phân công (`features/sales-owner`) dùng chung mà không import chéo feature.
 *
 * Endpoint mới: trả 400 / 403 / 404 (BE chưa có, không quyền) → `null` = không dùng được, màn hình ẩn phần đó.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SALES_OWNER_API } from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

/** Mọi trường ngoài id / tên đọc lỏng: BE làm song song, trường vắng không làm vỡ trang. */
export const salesWorkloadRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  paused: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  capacityPerMonth: z.number().int().nullish(),
  onLeave: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  coverName: z.string().nullish(),
  coverUntil: z.string().nullish(),
  customers: z.number().int().nullish(),
  customersWithOpenOrders: z.number().int().nullish(),
  openQuotes: z.number().int().nullish(),
  contractsAwaitingSignature: z.number().int().nullish(),
  revenue30d: z.number().nullish(),
  newCustomersThisMonth: z.number().int().nullish(),
});
export const salesWorkloadSchema = z.array(salesWorkloadRowSchema);
export type SalesWorkloadRow = z.infer<typeof salesWorkloadRowSchema>;

/** Một Sale trong ô chọn: trạng thái tạm dừng / nghỉ để người chọn thấy trước khi giao. */
export interface SalesOption {
  userId: string;
  name: string;
  paused: boolean;
  onLeave: boolean;
  coverName: string | null;
  /** Nghỉ tới ngày nào (`GET /customers/sales-agents`, bảng tải). */
  coverUntil?: string | null;
}

export const salesWorkloadKeys = {
  all: ["sales-workload"] as const,
  board: () => [...salesWorkloadKeys.all, "board"] as const,
  agents: () => [...salesWorkloadKeys.all, "chat-agents"] as const,
  /** D42 `GET /customers/sales-agents` — dưới `all`: lịch thay / cài đặt phân công đổi thì tải lại. */
  assignable: () => [...salesWorkloadKeys.all, "assignable"] as const,
};

/** 400 / 403 / 404 của endpoint mới = chưa dùng được (BE chưa có hoặc không quyền), không phải lỗi trang. */
export function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && [400, 403, 404].includes(error.status);
}

/** Đọc endpoint mới: 400 / 403 / 404 → `null` (chưa dùng được), lỗi khác ném tiếp. */
export async function orUnavailable<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableError(error)) return null;
    throw error;
  }
}

export function fetchSalesWorkload(signal?: AbortSignal): Promise<SalesWorkloadRow[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(SALES_OWNER_API.workload, { signal });
    return salesWorkloadSchema.parse(data);
  });
}

/** Bảng tải (quản lý). `data === null`: không dùng được. */
export function useSalesWorkload(enabled = true) {
  return useQuery({
    queryKey: salesWorkloadKeys.board(),
    queryFn: ({ signal }) => fetchSalesWorkload(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

export const toSalesOption = (row: SalesWorkloadRow): SalesOption => ({
  userId: row.userId,
  name: row.name,
  paused: row.paused,
  onLeave: row.onLeave,
  coverName: row.coverName ?? null,
  coverUntil: row.coverUntil ?? null,
});

/**
 * Gợi ý Sale còn trống nhất (§10.4: "gợi ý Sale còn trống nhất trong số Sale không tạm dừng; Manager vẫn là người
 * chọn"): bỏ người tạm dừng, đang nghỉ, đã đủ sức chứa tháng này; ít khách nhất, rồi ít khách mới nhất, rồi theo tên.
 */
export function suggestLeastLoaded(rows: readonly SalesWorkloadRow[]): SalesWorkloadRow | null {
  const free = rows.filter(
    (row) =>
      !row.paused &&
      !row.onLeave &&
      (row.capacityPerMonth == null || (row.newCustomersThisMonth ?? 0) < row.capacityPerMonth),
  );
  const sorted = [...free].sort(
    (a, b) =>
      (a.customers ?? 0) - (b.customers ?? 0) ||
      (a.newCustomersThisMonth ?? 0) - (b.newCustomersThisMonth ?? 0) ||
      a.name.localeCompare(b.name, "vi"),
  );
  return sorted[0] ?? null;
}
