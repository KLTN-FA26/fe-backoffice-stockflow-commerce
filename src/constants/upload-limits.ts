const MIB = 1024 * 1024;

/** Phần JSON đi kèm và vỏ multipart (boundary, header từng phần) của một lần tải file: vài KiB, không phải MiB. */
export const MULTIPART_ENVELOPE_BYTES = 64 * 1024;

/**
 * Dung lượng tối đa của MỘT file theo loại, đúng BE `common/storage/FileCategory` (MB = MiB, như BE tính) — cũng là
 * số hiện cho người dùng ("File quá lớn (tối đa … MB)"):
 * - `productImage` — PRODUCT_IMAGE (ảnh biến thể), `printModel` — PRINT_MODEL (`.glb` của cấu hình in);
 * - `signedContract` — DOCUMENT (bản scan hợp đồng đã ký, `POST /orders/{id}/contract/signature`);
 * - `chatAttachment` — CHAT_ATTACHMENT (file gửi trong chat);
 * - `einvoiceAgreement` — EINVOICE (biên bản thoả thuận khi điều chỉnh hoá đơn);
 * - `waybillImport` — WAYBILL_IMPORT (file CSV số vận đơn).
 */
export const UPLOAD_FILE_MAX_MB = {
  productImage: 10,
  printModel: 10,
  signedContract: 25,
  chatAttachment: 20,
  einvoiceAgreement: 10,
  waybillImport: 2,
} as const;

export type UploadKind = keyof typeof UPLOAD_FILE_MAX_MB;

/** Byte tối đa của một file loại `kind` — để chặn ngay trên form trước khi gửi. */
export const uploadFileMaxBytes = (kind: UploadKind) => UPLOAD_FILE_MAX_MB[kind] * MIB;

/** Body tối đa của request tải một file loại `kind` qua BFF: file + vỏ multipart. */
export const uploadRequestMaxBytes = (kind: UploadKind) =>
  uploadFileMaxBytes(kind) + MULTIPART_ENVELOPE_BYTES;

/**
 * Body lớn nhất của một lần tải file qua BFF (`/api/backend/*`): loại file lớn nhất ở trên cộng vỏ multipart.
 * Dùng cho trần body mà proxy của Next đọc trước khi tới route handler (`experimental.proxyClientMaxBodySize` trong
 * `next.config.ts`); giới hạn thật theo từng route ở `lib/auth/server/body-limit.ts`. Không import gì.
 */
export const MAX_UPLOAD_REQUEST_BYTES =
  Math.max(...Object.values(UPLOAD_FILE_MAX_MB)) * MIB + MULTIPART_ENVELOPE_BYTES;

/** Câu báo khi file vượt giới hạn — trên form (chặn trước khi gửi) và khi BFF/BE trả 413 `PAYLOAD_TOO_LARGE`. */
export const fileTooLargeMessage = (kind: UploadKind) =>
  `File quá lớn (tối đa ${UPLOAD_FILE_MAX_MB[kind]} MB).`;
