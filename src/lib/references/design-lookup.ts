/**
 * Thiết kế khách đã xác nhận → `designSnapshotId` cho dòng báo giá / yêu cầu mẫu (SCRUM-403/448/449).
 *
 * BE PR #109 `DesignSnapshotController` (quyền `design-snapshots:READ`, chỉ back-office):
 * - `GET /design-snapshots?customerId=&sku=` — snapshot đã xác nhận của ĐÚNG khách, mới nhất trước; `sku`
 *   thu hẹp về thiết kế của sản phẩm chứa SKU phôi đó (khớp đúng mã).
 * - `GET /design-snapshots/{id}/preview?customerId=` — link ngắn hạn tới CUSTOMER_PREVIEW khách đã xác nhận;
 *   snapshot của khách khác → 404, file đổi checksum → 409.
 * Bản nháp (`GET /designs`) không còn dùng ở đây: đó là việc của designer / reviewer.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const artifactSchema = z.object({
  artifactId: z.string(),
  role: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  checksum: z.string(),
});

const confirmedSnapshotSchema = z.object({
  snapshotId: z.string(),
  draftId: z.string(),
  designName: z.string(),
  customerId: z.string(),
  productId: z.string().nullish(),
  checksum: z.string(),
  confirmedAt: z.string(),
  artifacts: z.array(artifactSchema).nullish(),
});
const confirmedSnapshotPageSchema = z.object({
  items: z.array(confirmedSnapshotSchema),
  totalElements: z.number().int(),
});

const snapshotPreviewSchema = z.object({
  snapshotId: z.string(),
  artifactId: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  checksum: z.string(),
  url: z.string(),
  expiresAt: z.string(),
});

export type ConfirmedSnapshot = z.infer<typeof confirmedSnapshotSchema>;
export type SnapshotPreview = z.infer<typeof snapshotPreviewSchema>;

/** Đủ cho một khách; Sales hiếm khi có hơn vài chục thiết kế đã xác nhận cho một khách. */
const SNAPSHOT_PAGE_SIZE = 50;

export const designSnapshotKeys = {
  all: ["references", "design-snapshots"] as const,
  confirmed: (customerId: string, sku: string) =>
    [...designSnapshotKeys.all, "confirmed", customerId, sku] as const,
  preview: (snapshotId: string, customerId: string) =>
    [...designSnapshotKeys.all, "preview", snapshotId, customerId] as const,
};

export async function fetchConfirmedSnapshots(
  customerId: string,
  sku: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ customerId, page: "0", size: String(SNAPSHOT_PAGE_SIZE) });
  if (sku) params.set("sku", sku);
  const { data } = await api.get<unknown>("/design-snapshots", { params, signal });
  return confirmedSnapshotPageSchema.parse(data);
}

export async function fetchSnapshotPreview(
  snapshotId: string,
  customerId: string,
  signal?: AbortSignal,
): Promise<SnapshotPreview> {
  const { data } = await api.get<unknown>(
    `/design-snapshots/${encodeURIComponent(snapshotId)}/preview`,
    { params: new URLSearchParams({ customerId }), signal },
  );
  return snapshotPreviewSchema.parse(data);
}

/** `sku` rỗng = mọi thiết kế đã xác nhận của khách. `enabled=false` khi thiếu quyền (tránh 403). */
export function useConfirmedSnapshots(customerId: string, sku: string, enabled = true) {
  return useQuery({
    queryKey: designSnapshotKeys.confirmed(customerId, sku),
    queryFn: ({ signal }) => fetchConfirmedSnapshots(customerId, sku, signal),
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.list,
  });
}

/** Link ký ngắn hạn (BE no-store): không giữ lâu trong cache, hỏi lại khi cần link mới. */
export function useSnapshotPreview(snapshotId: string, customerId: string, enabled = true) {
  return useQuery({
    queryKey: designSnapshotKeys.preview(snapshotId, customerId),
    queryFn: ({ signal }) => fetchSnapshotPreview(snapshotId, customerId, signal),
    enabled: enabled && !!snapshotId && !!customerId,
    ...QUERY_TIMES.detail,
  });
}
