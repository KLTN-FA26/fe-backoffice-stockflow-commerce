/**
 * File vận đơn và biên bản giao nhận (POD) của một đơn — Sale gửi khách khi khách xin qua chat (docs 09 §2, §7; BR-28).
 *   GET /fulfillment/orders/{id}/delivery-documents                         → lô đã bàn giao, POD + file vận đơn từng xe
 *   GET /fulfillment/orders/{id}/delivery-documents/pod-files/{f}/download-url      → link ngắn hạn
 *   GET /fulfillment/orders/{id}/delivery-documents/waybill-files/{f}/download-url  → link ngắn hạn
 * Quyền `fulfillment-delivery-documents:READ` (Sale, quản lý Sale, quản trị); khách không có (BR-05). Không lưu link.
 */

import { z } from "zod";

import { api } from "@/lib/api/client";

const documentSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  contentType: z.string().nullish(),
  sizeBytes: z.number(),
  uploadedAt: z.string(),
});

const vehicleSchema = z.object({
  loadId: z.string(),
  loadCode: z.string(),
  waybillNo: z.string().nullish(),
  waybillFiles: z.array(documentSchema),
});

const shipmentDocumentsSchema = z.object({
  shipmentId: z.string(),
  shipmentCode: z.string(),
  status: z.string(),
  podFiles: z.array(documentSchema),
  vehicles: z.array(vehicleSchema),
});

const linkSchema = z.object({ url: z.string() });

export type DeliveryDocument = z.infer<typeof documentSchema>;
export type ShipmentDocuments = z.infer<typeof shipmentDocumentsSchema>;
export type DeliveryDocumentKind = "pod-files" | "waybill-files";

const path = (orderId: string) =>
  `/fulfillment/orders/${encodeURIComponent(orderId)}/delivery-documents`;

export async function listDeliveryDocuments(
  orderId: string,
  signal?: AbortSignal,
): Promise<ShipmentDocuments[]> {
  const { data } = await api.get<unknown>(path(orderId), { signal });
  return z.array(shipmentDocumentsSchema).parse(data);
}

/** Link tải ngắn hạn của một file — lấy mỗi lần bấm, không lưu (BE ghi nhật ký tải). */
export async function getDeliveryDocumentLink(
  orderId: string,
  kind: DeliveryDocumentKind,
  fileId: string,
): Promise<string> {
  const { data } = await api.get<unknown>(
    `${path(orderId)}/${kind}/${encodeURIComponent(fileId)}/download-url`,
  );
  return linkSchema.parse(data).url;
}
