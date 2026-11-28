/**
 * Việc một Sale đang phụ trách, hiện trong hộp xác nhận khoá / vô hiệu hoá tài khoản (KE-HOACH sales-owner BR-S08, §6 "Khi
 * Admin khoá một tài khoản Sale"). BE `GET /identity/users/{id}/handover-summary` (`identity-users:READ`) →
 * `{customers, openConversations, openLeads}`. BE được phép thiếu `openConversations` khi module chat không cho đọc chéo
 * (HOP-DONG-API) → lấy từ `GET /chat/agents/workload` khi người xem có `sales-workload:READ`.
 *
 * Endpoint chưa có (404 / 400 / 403) hoặc lỗi → `null`: hộp xác nhận giữ nguyên như cũ. Khoá luôn làm được ngay (BR-S08:
 * vì an ninh, không bắt giao khách trước) — đây chỉ là thông tin.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SALES_OWNER_API, SALES_WORKLOAD_PERMISSIONS } from "@/constants/sales-owner";
import { api } from "@/lib/api/client";
import { usePermissionChecker } from "@/lib/auth/components/Can";

import { userKeys } from "./queries";

const count = z.number().int().min(0).nullish();

export const handoverSummarySchema = z.object({
  customers: count,
  openConversations: count,
  openLeads: count,
});

const workloadSchema = z.array(z.object({ userId: z.string(), openConversations: count }).loose());

export interface HandoverSummary {
  customers: number;
  /** `null` khi không đọc được (BE không gửi và không xem được bảng tải chat). */
  openConversations: number | null;
  openLeads: number | null;
}

async function openConversationsOf(userId: string, signal: AbortSignal): Promise<number | null> {
  try {
    const { data } = await api.get<unknown>(SALES_OWNER_API.chatWorkload, { signal });
    return workloadSchema.parse(data).find((row) => row.userId === userId)?.openConversations ?? 0;
  } catch {
    return null;
  }
}

export async function fetchHandoverSummary(
  userId: string,
  readWorkload: boolean,
  signal: AbortSignal,
): Promise<HandoverSummary> {
  const { data } = await api.get<unknown>(SALES_OWNER_API.handoverSummary(userId), { signal });
  const summary = handoverSummarySchema.parse(data);
  const openConversations =
    summary.openConversations ?? (readWorkload ? await openConversationsOf(userId, signal) : null);
  return {
    customers: summary.customers ?? 0,
    openConversations,
    openLeads: summary.openLeads ?? null,
  };
}

export const handoverSummaryKey = (userId: string) =>
  [...userKeys.all, "handover-summary", userId] as const;

/** Chỉ tải khi hộp xác nhận khoá / vô hiệu hoá mở (`enabled`); mỗi lần mở đọc lại số mới. */
export function useHandoverSummary(userId: string, enabled: boolean) {
  const can = usePermissionChecker();
  const readWorkload = can(SALES_WORKLOAD_PERMISSIONS.read);
  return useQuery({
    queryKey: handoverSummaryKey(userId),
    queryFn: ({ signal }) => fetchHandoverSummary(userId, readWorkload, signal),
    enabled,
    retry: false,
    staleTime: 0,
  });
}

/** Có gì để giao lại không — không có thì hộp xác nhận giữ như cũ (tài khoản không phải Sale). */
export function hasHandover(summary: HandoverSummary | undefined): summary is HandoverSummary {
  return (
    !!summary &&
    (summary.customers > 0 || (summary.openConversations ?? 0) > 0 || (summary.openLeads ?? 0) > 0)
  );
}
