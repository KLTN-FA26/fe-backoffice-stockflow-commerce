/**
 * Dữ liệu đọc kèm một LSX cho màn quét xuất phôi và QC (BE PR #109):
 * - `GET …/material-issues/pending` (SCRUM-410) — còn phải quét gì: cần / đã xuất / còn thiếu + các phiếu giữ.
 * - `GET …/approved-sample` (SCRUM-418/419, BR-PRD-05) — lần mẫu khách đã duyệt + ảnh khách duyệt.
 * - `GET …/packing-locations` (SCRUM-412) — khu PACKING dùng được; một khu = mặc định.
 */

import { z } from "zod";

export const pendingHoldDtoSchema = z.object({
  reservationId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  locationCode: z.string(),
  quantity: z.number().int(),
  /** Mã vạch của SKU (logistics); null khi SKU chưa khai báo mã vạch. */
  barcode: z.string().nullish(),
});

export const pendingIssueDtoSchema = z.object({
  productionOrderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  blankSku: z.string(),
  required: z.number().int(),
  issued: z.number().int(),
  outstanding: z.number().int(),
  /** Rỗng khi còn thiếu phôi = chưa giữ phôi nào: lần quét kế tiếp sẽ giữ trong kho của lệnh. */
  holds: z.array(pendingHoldDtoSchema),
});

const approvedPreviewDtoSchema = z.object({
  artifactId: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  checksum: z.string(),
  url: z.string(),
  expiresAt: z.string(),
});

export const approvedSampleDtoSchema = z.object({
  productionOrderId: z.string(),
  productionOrderNumber: z.string(),
  sampleRequestId: z.string(),
  sampleRequestNumber: z.string(),
  round: z.number().int(),
  approvedAt: z.string().nullish(),
  designSnapshotId: z.string(),
  designChecksum: z.string(),
  sampleProductionOrderId: z.string().nullish(),
  sampleProductionOrderNumber: z.string().nullish(),
  /** null = bộ thiết kế đã xác nhận không có ảnh CUSTOMER_PREVIEW (một câu trả lời, không phải lỗi). */
  preview: approvedPreviewDtoSchema.nullish(),
});

export const packingLocationsDtoSchema = z.array(z.string());
