/**
 * Shipping — zod DTO file đính kèm (BE `WaybillFileResponse`, `PodFileResponse`, `WaybillFileResponse.Link`; docs 09 §4.4,
 * §4.3 bước 2, BR-28). BE bỏ null khỏi JSON nên trường tuỳ chọn khai `.nullish()`. `uploadedBy` là id người tải;
 * `uploadedByName` (#286) là tên để hiển thị — BE cũ chưa trả thì vắng.
 */

import { z } from "zod";

import { isoInstant } from "./schemas";

/** Một file đính kèm của chuyến (file vận đơn) hoặc của lô giao (POD): hai DTO cùng hình, khác khoá cha. */
export const beAttachedFileSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().int().min(0),
  uploadedBy: z.string().nullish(),
  uploadedByName: z.string().nullish(),
  uploadedAt: isoInstant,
});

export const beAttachedFileListSchema = z.array(beAttachedFileSchema);

/** BE `DownloadLink`: link ngắn hạn lưu file theo tên của nó. Là thông tin xác thực — không log, không lưu. */
export const beDownloadLinkSchema = z.object({
  url: z.string().min(1),
  expiresAt: isoInstant.nullish(),
});

export type AttachedFile = z.infer<typeof beAttachedFileSchema>;
export type DownloadLink = z.infer<typeof beDownloadLinkSchema>;
