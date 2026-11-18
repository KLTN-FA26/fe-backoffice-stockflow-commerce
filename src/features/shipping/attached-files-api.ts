/**
 * Shipping — API file đính kèm: file vận đơn của chuyến (BE `LoadWaybillController`) và POD của lô giao (BE
 * `ShipmentPodController`; docs 09 §4.4, §4.3 bước 2, BR-28). Cùng một hợp đồng, khác đường dẫn (`AttachedFilesTarget`):
 *
 *   GET  {base}                       → danh sách, cũ nhất trước (`fulfillment-shipments:READ`)
 *   POST {base}/uploads               {fileName, contentType, sizeBytes, sha256} → slot PUT thẳng lên kho (201)
 *   POST {base}                       {uploadId} → đính kèm file đã tải lên kho (201); cùng uploadId gửi lại trả cùng file
 *   GET  {base}/{fileId}/download-url → {url, expiresAt}: link ngắn hạn, ghi nhật ký kiểm toán
 *
 * Quyền tải lên: file vận đơn `fulfillment-dispatch:UPDATE`, POD `fulfillment-delivery-outcomes:UPDATE`. Tải thẳng lên kho
 * (không qua BFF `/api/backend`, nên không vướng trần body của BFF) — `lib/api/direct-upload.ts`.
 */

import { api } from "@/lib/api/client";
import { uploadFileDirect, uploadSlotSchema } from "@/lib/api/direct-upload";

import {
  beAttachedFileListSchema,
  beAttachedFileSchema,
  beDownloadLinkSchema,
} from "./attached-files-schemas";

import type { DirectUploadProgress, UploadDeclaration } from "@/lib/api/direct-upload";
import type { AttachedFile } from "./attached-files-schemas";
import type { AttachedFilesTarget } from "./attached-files";

export async function listAttachedFiles(
  target: AttachedFilesTarget,
  ownerId: string,
  signal?: AbortSignal,
): Promise<AttachedFile[]> {
  const { data } = await api.get<unknown>(target.basePath(ownerId), { signal });
  return beAttachedFileListSchema.parse(data);
}

/** Bước 1: khai báo file, nhận đường PUT ngắn hạn (trả body BE chưa parse để `uploadFileDirect` parse). */
async function beginAttachedUpload(
  target: AttachedFilesTarget,
  ownerId: string,
  declaration: UploadDeclaration,
  signal?: AbortSignal,
): Promise<ReturnType<typeof uploadSlotSchema.parse>> {
  const { data } = await api.post<unknown>(`${target.basePath(ownerId)}/uploads`, declaration, {
    signal,
  });
  return uploadSlotSchema.parse(data);
}

export interface UploadAttachedFileInput {
  target: AttachedFilesTarget;
  ownerId: string;
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: DirectUploadProgress) => void;
}

/** Bước 1-3: băm → xin slot → PUT lên kho → đính kèm bằng `uploadId`. Trả file đã đính kèm. */
export async function uploadAttachedFile({
  target,
  ownerId,
  file,
  signal,
  onProgress,
}: UploadAttachedFileInput): Promise<AttachedFile> {
  const uploadId = await uploadFileDirect({
    file,
    signal,
    onProgress,
    declare: (declaration, abort) => beginAttachedUpload(target, ownerId, declaration, abort),
  });
  const { data } = await api.post<unknown>(target.basePath(ownerId), { uploadId }, { signal });
  return beAttachedFileSchema.parse(data);
}

/** Link tải ngắn hạn của một file — hỏi lại mỗi lần bấm, không lưu. */
export async function getAttachedFileLink(
  target: AttachedFilesTarget,
  ownerId: string,
  fileId: string,
): Promise<string> {
  const { data } = await api.get<unknown>(
    `${target.basePath(ownerId)}/${encodeURIComponent(fileId)}/download-url`,
  );
  return beDownloadLinkSchema.parse(data).url;
}
