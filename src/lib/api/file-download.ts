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

const EXTENDED_NAME = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i;
const PLAIN_NAME = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]+))/i;
const ENCODED_WORD = /=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g;

/** `%E1%BA%BF` → byte; chuỗi hỏng (không phải UTF-8 hợp lệ) → null để rơi về tên khác. */
function percentDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return null;
  }
}

/** Một "encoded word" RFC 2047 (`=?UTF-8?Q?Phi=E1=BA=BFu?=` / `?B?`) → chuỗi; charset khác UTF-8 thì để nguyên. */
function decodeEncodedWords(value: string): string {
  return value.replace(ENCODED_WORD, (word, charset: string, kind: string, text: string) => {
    if (charset.toLowerCase() !== "utf-8") return word;
    try {
      const binary =
        kind.toUpperCase() === "B"
          ? atob(text)
          : text
              .replace(/_/g, " ")
              .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
                String.fromCharCode(parseInt(hex, 16)),
              );
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return word;
    }
  });
}

/**
 * Tên file trong `Content-Disposition`. BE giấy tờ (`PdfDownload`, Spring `ContentDisposition` với charset UTF-8) gửi
 * `filename="=?UTF-8?Q?...?="; filename*=UTF-8''Phi%E1%BA%BFu...` — tên tiếng Việt có dấu: ưu tiên `filename*`
 * (RFC 5987/6266), rồi `filename` (giải RFC 2047 nếu là encoded word), không có thì null.
 */
export function fileNameFromDisposition(disposition: string): string | null {
  const extended = EXTENDED_NAME.exec(disposition);
  const fromExtended = extended?.[2] ? percentDecode(extended[2].replace(/^"|"$/g, "")) : null;
  if (fromExtended) return fromExtended;
  const plain = PLAIN_NAME.exec(disposition);
  const name = (plain?.[1] ?? plain?.[2])?.trim();
  return name ? decodeEncodedWords(name) : null;
}

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
  const fileName = typeof disposition === "string" ? fileNameFromDisposition(disposition) : null;
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
