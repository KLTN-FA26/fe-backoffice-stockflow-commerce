/**
 * Sale giao được làm người phụ trách / người thay / người nhận lead (hợp đồng sales-owner, D42: chỉ tài khoản SALES_STAFF
 * đang làm; Sales Manager / System Admin điều phối, không bao giờ được giao). MỘT nguồn cho mọi ô chọn: đổi / giao người
 * phụ trách, chuyển khách hàng loạt, lịch người thay, giao lead, quyết yêu cầu đổi Sale, form tạo khách và lọc "theo Sale"
 * của danh sách khách.
 *
 * Nguồn chính: `GET /customers/sales-agents` (`customer-sales-owners:READ` hoặc `staff-covers:READ`). BE chưa có / không
 * quyền (404 / 400 / 403) → nguồn cũ, lọc hết mức FE làm được:
 * - có `sales-workload:READ`: bảng tải `GET /sales/workload` (BE-C: mỗi Sale đang làm một dòng);
 * - không thì người trả lời chat `GET /chat/agents` — có cả quản lý / admin, nên bỏ người có vai trò điều phối theo
 *   `GET /chat/staff` (đọc được thì) và bỏ chính người xem khi họ là quản lý.
 * BE vẫn kiểm lại (`SALES_OWNER_NOT_ASSIGNABLE`).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { CHAT_PERMISSIONS } from "@/constants";
import {
  SALES_OWNER_API,
  SALES_OWNER_PERMISSIONS,
  SALES_WORKLOAD_PERMISSIONS,
} from "@/constants/sales-owner";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";

import {
  orUnavailable,
  salesWorkloadKeys,
  toSalesOption,
  useSalesWorkload,
} from "./sales-workload";

import type { SalesOption } from "./sales-workload";

const flag = z
  .boolean()
  .nullish()
  .transform((v) => v ?? false);

/** Hợp đồng: `[{userId, name, paused, onLeave, coverUntil}]`; trường ngoài id / tên đọc lỏng. */
export const salesAgentSchema = z.object({
  userId: z.string(),
  name: z.string(),
  paused: flag,
  onLeave: flag,
  coverUntil: z.string().nullish(),
});
const salesAgentListSchema = z.array(salesAgentSchema);

export async function fetchSalesAgents(signal?: AbortSignal): Promise<SalesOption[] | null> {
  return orUnavailable(async () => {
    const { data } = await api.get<unknown>(SALES_OWNER_API.salesAgents, { signal });
    return salesAgentListSchema
      .parse(data)
      .map((row) => ({ ...row, coverName: null, coverUntil: row.coverUntil ?? null }));
  });
}

/** Vai trò điều phối (D42): không bao giờ là người phụ trách / người thay. */
const COORDINATOR_ROLES = new Set(["SALES_MANAGER", "SYSTEM_ADMIN"]);
const SALES_ROLE = "SALES_STAFF";

const chatStaffSchema = z.array(
  z.object({
    id: z.string(),
    role: z.string().nullish(),
    roles: z
      .array(z.object({ code: z.string() }))
      .nullish()
      .catch(null),
  }),
);

/** Id người có vai trò điều phối mà không có vai trò Sale; đọc không được → tập rỗng (không lọc được thì thôi). */
async function coordinatorIds(signal?: AbortSignal): Promise<ReadonlySet<string>> {
  try {
    const { data } = await api.get<unknown>(SALES_OWNER_API.chatStaff, {
      params: { q: "", limit: 50 },
      signal,
    });
    const ids = new Set<string>();
    for (const person of chatStaffSchema.parse(data)) {
      const codes = [person.role, ...(person.roles ?? []).map((r) => r.code)].filter(Boolean);
      const coordinator = codes.some((code) => code && COORDINATOR_ROLES.has(code));
      if (coordinator && !codes.includes(SALES_ROLE)) ids.add(person.id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

/** Bỏ người điều phối khỏi nguồn cũ (D42). Thuần — test được. */
export function assignableOnly(
  options: readonly SalesOption[],
  viewer: { meId: string | null; isManager: boolean },
  coordinators: ReadonlySet<string> = new Set(),
): SalesOption[] {
  return options.filter(
    (option) =>
      !coordinators.has(option.userId) && !(viewer.isManager && option.userId === viewer.meId),
  );
}

const chatAgentSchema = z.array(z.object({ userId: z.string(), name: z.string() }));

async function fetchChatAgents(
  viewer: { meId: string | null; isManager: boolean },
  signal?: AbortSignal,
): Promise<SalesOption[] | null> {
  return orUnavailable(async () => {
    const [{ data }, coordinators] = await Promise.all([
      api.get<unknown>(SALES_OWNER_API.chatAgents, { signal }),
      coordinatorIds(signal),
    ]);
    const options = chatAgentSchema
      .parse(data)
      .map((agent) => ({ ...agent, paused: false, onLeave: false, coverName: null }));
    return assignableOnly(options, viewer, coordinators);
  });
}

export interface AssignableSales {
  /** `undefined`: đang tải; `null`: không có nguồn nào dùng được (ô chọn ẩn / báo chưa tải được). */
  options: SalesOption[] | null | undefined;
  isPending: boolean;
  isError: boolean;
}

/** Sale giao được (D42) cho mọi ô chọn — xem đầu file. */
export function useAssignableSales(enabled = true): AssignableSales {
  const can = usePermissionChecker();
  const meId = useAuthStore((state) => state.user?.userId ?? null);
  const viewer = { meId, isManager: can(SALES_OWNER_PERMISSIONS.update) };
  const canWorkload = can(SALES_WORKLOAD_PERMISSIONS.read);
  const canChat = can(CHAT_PERMISSIONS.read);
  const agents = useQuery({
    queryKey: salesWorkloadKeys.assignable(),
    queryFn: ({ signal }) => fetchSalesAgents(signal),
    enabled,
    // 404 / 400 / 403 = chưa có: chuyển sang nguồn cũ ngay, không thử lại
    retry: false,
    ...QUERY_TIMES.list,
  });
  const fallback = enabled && agents.data === null;
  const board = useSalesWorkload(fallback && canWorkload);
  const chat = useQuery({
    queryKey: [...salesWorkloadKeys.agents(), viewer.meId, viewer.isManager] as const,
    queryFn: ({ signal }) => fetchChatAgents(viewer, signal),
    enabled: fallback && !canWorkload && canChat,
    ...QUERY_TIMES.master,
  });
  if (!enabled) return { options: null, isPending: false, isError: false };
  if (agents.isPending) return { options: undefined, isPending: true, isError: false };
  if (agents.isError) return { options: null, isPending: false, isError: true };
  if (agents.data) return { options: agents.data, isPending: false, isError: false };
  const source = canWorkload ? board : canChat ? chat : null;
  if (!source) return { options: null, isPending: false, isError: false };
  if (source.isPending) return { options: undefined, isPending: true, isError: false };
  const options = canWorkload ? (board.data?.map(toSalesOption) ?? null) : (chat.data ?? null);
  return {
    options: options && assignableOnly(options, viewer),
    isPending: false,
    isError: source.isError,
  };
}
