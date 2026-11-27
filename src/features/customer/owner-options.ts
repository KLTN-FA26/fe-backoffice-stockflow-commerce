/**
 * Sale chọn được làm người phụ trách khi Sales Manager tạo khách (KE-HOACH sales-owner BR-S02, BR-S04: chỉ giao cho Sale
 * đang làm và có quyền chat với khách). Nguồn: BE `GET /chat/agents` (người trả lời khách được — tài khoản ACTIVE,
 * `SALES_STAFF`). Không đọc được → không có ô chọn, khách tạo ra chưa có người phụ trách (Manager giao sau).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SALES_OWNER_API } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { customerKeys } from "./queries";

const ownerOptionSchema = z.object({ userId: z.string(), name: z.string() });
export type SalesOwnerOption = z.infer<typeof ownerOptionSchema>;

export async function listSalesOwnerOptions(signal?: AbortSignal): Promise<SalesOwnerOption[]> {
  const { data } = await api.get<unknown>(SALES_OWNER_API.agents, { signal });
  return z
    .array(ownerOptionSchema)
    .parse(data)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export function useSalesOwnerOptions(enabled: boolean) {
  return useQuery({
    queryKey: [...customerKeys.all, "sales-owner-options"] as const,
    queryFn: ({ signal }) => listSalesOwnerOptions(signal),
    enabled,
    retry: false,
    ...QUERY_TIMES.master,
  });
}
