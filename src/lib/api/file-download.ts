/**
 * Tải một file do BE sinh (PDF phiếu xếp hàng, nhãn…) về máy: `getFile` gọi GET với `responseType: "blob"` rồi đọc tên
 * file từ `Content-Disposition`; `saveFile` đưa Blob cho trình duyệt lưu. Thành công BE trả file, lỗi vẫn là JSON
 * envelope — `lib/api/client` đọc body Blob ra trước khi map `ApiError` (`readBlobErrorBody`), nên 403/404 vẫn có mã lỗi.
 */

import { api } from "./client";

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

const FILE_NAME = /filename="?([^";]+)"?/i;

/** GET `path` thành file; thiếu `Content-Disposition` thì dùng `fallbackName`. */
export async function getFile(
  path: string,
  fallbackName: string,
  signal?: AbortSignal,
  /** `Accept` header; mặc định PDF (BE đặt Content-Type thật của file). */
  accept = "application/pdf, application/json",
): Promise<DownloadedFile> {
  const response = await api.get<Blob>(path, {
    responseType: "blob",
    headers: { Accept: accept },
    signal,
  });
  const disposition: unknown = response.headers["content-disposition"];
  const fileName = typeof disposition === "string" ? FILE_NAME.exec(disposition)?.[1] : undefined;
  return { blob: response.data, fileName: fileName ?? fallbackName };
}

/** Lưu file bằng thẻ `<a download>` tạm; thu hồi blob URL ngay sau khi bấm. */
export function saveFile({ blob, fileName }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
