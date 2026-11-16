/**
 * Tải tệp thẳng lên kho lưu trữ (BE `StagedUploads`, `docs/direct-uploads-fe-contract.md`): tệp KHÔNG đi qua backend.
 * Ba bước — (1) khai báo `{fileName, contentType, sizeBytes, sha256}` ở endpoint "slot" của chức năng sở hữu → `{uploadId,
 * method, url, headers, expiresAt}`; (2) `PUT` đúng các byte đó lên `url` với đúng `headers` (nằm trong chữ ký, kho từ chối
 * byte khác); (3) bản ghi gọi tên `uploadId` ở request riêng của nó (bước này do chức năng gọi, không ở đây).
 *
 * Module này làm bước 1-2 cho MỌI chức năng: băm SHA-256 trong trình duyệt (`crypto.subtle`), gọi `declare` (endpoint slot do
 * chức năng cấp), rồi PUT có tiến độ. `url` là thông tin xác thực ngắn hạn (15 phút): không log, không lưu.
 *
 * Hai đường PUT: URL TUYỆT ĐỐI (kho thật, khác origin) đi bằng một axios riêng — KHÔNG qua `api` vì interceptor của `api`
 * thêm `X-Warehouse-Id` / `Content-Type: application/json` làm sai chữ ký và gây CORS preflight; URL TƯƠNG ĐỐI (cùng origin:
 * mock adapter) đi qua `api`. Không có tiến độ khi kho không báo tổng dung lượng — `percent` giữ nguyên tới khi xong.
 */

import axios from "axios";
import { z } from "zod";

import { api } from "./client";

import type { AxiosError } from "axios";

/** Khai báo tệp của bước 1 — đúng `UploadSlotRequest` của BE; `sha256` là hex thường 64 ký tự. */
export interface UploadDeclaration {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}

/** BE `UploadSlot` — Jackson `non_null`, `headers` luôn có nhưng có thể rỗng. */
export const uploadSlotSchema = z.object({
  uploadId: z.string(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()).default({}),
  expiresAt: z.string().nullish(),
});
export type UploadSlot = z.infer<typeof uploadSlotSchema>;

/** Giai đoạn đang chạy — để UI hiện "Đang kiểm tra tệp…" / "Đang tải lên 40%". */
export type DirectUploadStage = "hashing" | "declaring" | "uploading";

export interface DirectUploadProgress {
  stage: DirectUploadStage;
  /** 0–100; chỉ có nghĩa ở giai đoạn `uploading`. */
  percent: number;
}

/**
 * Lỗi của bước PUT (kho từ chối / mất mạng / người dùng huỷ). Lỗi của bước 1 là `ApiError` do `declare` ném ra — giữ nguyên
 * để chức năng map theo `error.code`.
 * - `refused`: kho trả lỗi (đường tải hết hạn, chữ ký / byte không khớp, tệp bị đổi) → chọn lại tệp, xin slot mới;
 * - `network`: không tới được kho;
 * - `aborted`: người dùng bỏ tệp.
 */
export class DirectUploadError extends Error {
  constructor(
    readonly kind: "refused" | "network" | "aborted",
    readonly status: number | null = null,
  ) {
    super(`Direct upload ${kind}${status ? ` (${status})` : ""}`);
    this.name = "DirectUploadError";
  }
}

/** SHA-256 hex thường của nội dung tệp (`crypto.subtle`, hợp lệ với `UploadSlotRequest.sha256`). */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Axios riêng cho kho: không baseURL, không interceptor của `api`, không header mặc định (export để test thay transport). */
export const storageClient = axios.create({ timeout: 0 });

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

export interface DirectUploadOptions {
  file: File;
  /** Bước 1 của chức năng sở hữu: POST khai báo tới endpoint slot, trả body BE chưa parse. */
  declare: (declaration: UploadDeclaration, signal?: AbortSignal) => Promise<unknown>;
  onProgress?: (progress: DirectUploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Băm → khai báo → PUT. Trả `uploadId` để chức năng gắn vào bản ghi của nó (bước 3).
 *
 * @throws ApiError từ `declare` (415 / 413 / 400 / 429 / 404 / 409 …); `DirectUploadError` từ bước PUT; ZodError nếu slot sai hợp đồng
 */
export async function uploadFileDirect(options: DirectUploadOptions): Promise<string> {
  const { file, declare, onProgress, signal } = options;
  onProgress?.({ stage: "hashing", percent: 0 });
  const sha256 = await sha256Hex(file);
  throwIfAborted(signal);
  onProgress?.({ stage: "declaring", percent: 0 });
  const slot = uploadSlotSchema.parse(
    await declare(
      { fileName: file.name, contentType: file.type, sizeBytes: file.size, sha256 },
      signal,
    ),
  );
  throwIfAborted(signal);
  onProgress?.({ stage: "uploading", percent: 0 });
  const client = isAbsoluteUrl(slot.url) ? storageClient : api;
  try {
    await client.request({
      method: slot.method,
      url: slot.url,
      data: file,
      headers: slot.headers,
      signal,
      onUploadProgress: ({ loaded, total }) => {
        if (total)
          onProgress?.({ stage: "uploading", percent: Math.round((loaded / total) * 100) });
      },
    });
  } catch (error: unknown) {
    // `api` đổi mọi lỗi thành ApiError (huỷ cũng thành NETWORK_ERROR) nên xét `signal` trước
    throw signal?.aborted ? new DirectUploadError("aborted") : toDirectUploadError(error);
  }
  onProgress?.({ stage: "uploading", percent: 100 });
  return slot.uploadId;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DirectUploadError("aborted");
}

function toDirectUploadError(error: unknown): DirectUploadError {
  if (error instanceof DirectUploadError) return error;
  if (axios.isCancel(error)) return new DirectUploadError("aborted");
  const status = (error as Partial<AxiosError> | undefined)?.response?.status;
  // `api` đã đổi lỗi thành `ApiError` (có `status`); axios riêng thì còn `response`
  const apiStatus = (error as { status?: unknown } | undefined)?.status;
  const code = typeof status === "number" ? status : typeof apiStatus === "number" ? apiStatus : 0;
  return code > 0 ? new DirectUploadError("refused", code) : new DirectUploadError("network");
}
