/**
 * Thiết kế đã khách xác nhận → `designSnapshotId` cho dòng báo giá / yêu cầu mẫu.
 *
 * BE (d215f6e, DesignWorkflowController): `GET /designs` chỉ trả bản nháp mà người gọi là owner /
 * designer được gán / reviewer — KHÔNG lọc theo khách. Sales chỉ thấy thiết kế mình tham gia.
 * Đây là GAP BE (ghi ở FE-API-READINESS): chưa có "snapshot đã xác nhận của khách X". UI cho phép
 * dán mã snapshot khi không tìm thấy trong danh sách; BE vẫn kiểm tra quyền sở hữu + xác nhận.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

const designDraftSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  productId: z.string(),
  name: z.string(),
  status: z.string(),
});
const designPageSchema = z.object({ items: z.array(designDraftSchema) });

const designSnapshotSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  checksum: z.string(),
  confirmedAt: z.string(),
});

export type DesignDraftRef = z.infer<typeof designDraftSchema>;
export type DesignSnapshotRef = z.infer<typeof designSnapshotSchema>;

export const designRefKeys = {
  all: ["references", "designs"] as const,
  visible: () => [...designRefKeys.all, "visible"] as const,
  snapshot: (draftId: string) => [...designRefKeys.all, "snapshot", draftId] as const,
};

/** Thiết kế người dùng hiện tại được thấy, lọc theo khách ở client. */
export function useVisibleDesigns(customerId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: designRefKeys.visible(),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: "0", size: "200" });
      const { data } = await api.get<unknown>("/designs", { params, signal });
      return designPageSchema.parse(data).items;
    },
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.list,
  });
  return {
    ...query,
    designs: (query.data ?? []).filter((design) => design.customerId === customerId),
  };
}

/** Snapshot đã xác nhận của một bản nháp; 404 = khách chưa xác nhận → `null`. */
export async function fetchDesignSnapshot(
  draftId: string,
  signal?: AbortSignal,
): Promise<DesignSnapshotRef | null> {
  try {
    const { data } = await api.get<unknown>(`/designs/${encodeURIComponent(draftId)}/snapshot`, {
      signal,
    });
    return designSnapshotSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
