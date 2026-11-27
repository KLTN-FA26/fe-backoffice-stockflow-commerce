/**
 * Danh sách Sale đang làm cho ô chọn người phụ trách / người thay / người nhận lead (kế hoạch sales-owner §10.4). Đặt ở
 * `lib/references` để trang khách (`features/customer`) và các màn phân công (`features/sales-owner`) dùng chung mà không
 * import chéo feature.
 *
 * - Quản lý (`sales-workload:READ`): `GET /sales/workload` — mỗi Sale đang làm một dòng, kèm tạm dừng / sức chứa / nghỉ
 *   phép / số khách (hợp đồng BE-C "Workload").
 * - Sale (không có bảng tải): `GET /chat/agents` — người trả lời khách được (tên, trực tuyến), đủ để chọn người thay.
 *
 * Endpoint mới: trả 400 / 403 / 404 (BE chưa có, không quyền) → `null` = không dùng được, màn hình ẩn phần đó.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

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

const chatAgentSchema = z.object({ userId: z.string(), name: z.string() });

/** Một Sale trong ô chọn: trạng thái tạm dừng / nghỉ để người chọn thấy trước khi giao. */
export interface SalesOption {
  userId: string;
  name: string;
  paused: boolean;
  onLeave: boolean;
  coverName: string | null;
}

export const salesWorkloadKeys = {
  all: ["sales-workload"] as const,
  board: () => [...salesWorkloadKeys.all, "board"] as const,
  agents: () => [...salesWorkloadKeys.all, "chat-agents"] as const,
};

/** 400 / 403 / 404 của endpoint mới = chưa dùng được (BE chưa có hoặc không quyền), không phải lỗi trang. */
export function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && [400, 403, 404].includes(error.status);
}

async function orUnavailable<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableError(error)) return null;
    throw error;
  }
}

export function fetchSalesWorkload(signal?: AbortSignal): Promise<SalesWorkloadRow[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>("/sales/workload", { signal });
    return salesWorkloadSchema.parse(data);
  });
}

async function fetchChatAgents(signal?: AbortSignal): Promise<SalesOption[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>("/chat/agents", { signal });
    return z
      .array(chatAgentSchema)
      .parse(data)
      .map((agent) => ({ ...agent, paused: false, onLeave: false, coverName: null }));
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
});

/**
 * Sale cho ô chọn: bảng tải khi người dùng xem được (có trạng thái tạm dừng / nghỉ), không thì danh sách người trả lời
 * chat. `options === null`: không có nguồn nào dùng được.
 */
export function useSalesOptions({ workload, agents }: { workload: boolean; agents: boolean }) {
  const board = useSalesWorkload(workload);
  const chat = useQuery({
    queryKey: salesWorkloadKeys.agents(),
    queryFn: ({ signal }) => fetchChatAgents(signal),
    enabled: agents && !workload,
    ...QUERY_TIMES.master,
  });
  const source = workload ? board : agents ? chat : null;
  const options: SalesOption[] | null | undefined = !source
    ? null
    : workload
      ? board.data === undefined
        ? undefined
        : (board.data?.map(toSalesOption) ?? null)
      : chat.data;
  return { options, isPending: !!source && source.isPending, isError: !!source?.isError };
}

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
