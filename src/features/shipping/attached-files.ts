/**
 * Shipping — phần thuần của file đính kèm (file vận đơn của chuyến, POD của lô giao; docs 09 §4.4, §4.3 bước 2, BR-28):
 * đường dẫn BE, khoá cache, kiểm file ở máy trước khi gửi, định dạng dung lượng / loại, câu lỗi tiếng Việt, mở link tải.
 */

import {
  SHIPPING_FILE_LABELS,
  SHIPPING_FILE_RULES,
  SHIPPING_FILE_TYPE_LABELS,
} from "@/constants/shipping-files";
import { ApiError } from "@/lib/api/error";
import { DirectUploadError } from "@/lib/api/direct-upload";
import { formatFixed, formatNumber } from "@/lib/format/number";

import { loadPath } from "./api";
import { loadKeys, shipmentKeys } from "./queries";
import { SHIPMENTS_PATH } from "./shipment-api";

import type { ShippingFileKind } from "@/constants/shipping-files";

const L = SHIPPING_FILE_LABELS;

/** Một loại file đính kèm: nơi BE giữ nó và khoá cache danh sách. */
export interface AttachedFilesTarget {
  readonly kind: ShippingFileKind;
  /** `/fulfillment/loads/{id}/waybill-files` hoặc `/fulfillment/shipments/{id}/pod-files`. */
  readonly basePath: (ownerId: string) => string;
  readonly queryKey: (ownerId: string) => readonly unknown[];
}

/** BE `LoadWaybillController`: `GET`/`POST …/waybill-files`, `POST …/waybill-files/uploads`, `GET …/{fileId}/download-url`. */
export const WAYBILL_FILES: AttachedFilesTarget = {
  kind: "waybill",
  basePath: (loadId) => `${loadPath(loadId)}/waybill-files`,
  // Dưới `loadKeys.all`: làm mới chuyến cũng làm mới danh sách file
  queryKey: (loadId) => [...loadKeys.all, "waybill-files", loadId],
};

/** BE `ShipmentPodController`: `GET`/`POST …/pod-files`, `POST …/pod-files/uploads`, `GET …/{fileId}/download-url`. */
export const POD_FILES: AttachedFilesTarget = {
  kind: "pod",
  basePath: (shipmentId) => `${SHIPMENTS_PATH}/${encodeURIComponent(shipmentId)}/pod-files`,
  queryKey: (shipmentId) => [...shipmentKeys.all, "pod-files", shipmentId],
};

/** Dung lượng người đọc được: 1.234 B → "1,2 KB"; dưới 1 KB giữ số byte. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatFixed(kb, kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${formatFixed(mb, mb < 10 ? 1 : 0)} MB`;
}

/** Tên loại file theo `contentType`; thiếu / lạ → "Tệp". */
export function fileTypeLabel(contentType: string | null | undefined): string {
  return (contentType && SHIPPING_FILE_TYPE_LABELS[contentType]) || L.common.typeOther;
}

/**
 * Kiểm file TRƯỚC khi xin đường tải (BE kiểm lại theo byte: 415 / 413). Trả câu lỗi tiếng Việt hoặc `null` nếu hợp lệ.
 * `file.type` do trình duyệt đoán theo đuôi file; thiếu → coi là không đúng loại.
 */
export function attachedFileProblem(
  kind: ShippingFileKind,
  file: Pick<File, "size" | "type">,
): string | null {
  const rules = SHIPPING_FILE_RULES[kind];
  if (file.size <= 0) return L.common.fileProblem.empty;
  if (file.size > rules.maxBytes) return L.common.fileProblem.tooLarge;
  if (!(rules.contentTypes as readonly string[]).includes(file.type)) {
    return L[kind].typeNotAccepted;
  }
  return null;
}

/**
 * Lỗi tải file lên (xin đường tải ở BE + PUT lên kho + đính kèm) → câu tiếng Việt. Không bao giờ hiện message tiếng Anh
 * của BE / kho. Nhận `unknown`: lỗi đến từ BE (ApiError), bước PUT (DirectUploadError) hoặc parse slot (ZodError).
 */
export function attachedFileUploadError(kind: ShippingFileKind, error: unknown): string {
  const E = L.common.error;
  if (error instanceof DirectUploadError) {
    return error.kind === "network" ? E.network : E.storageRefused;
  }
  if (!(error instanceof ApiError)) return E.unknown;
  switch (error.code) {
    case "UNSUPPORTED_MEDIA_TYPE":
      return E.unsupportedType;
    case "PAYLOAD_TOO_LARGE":
      return E.tooLarge;
    case "VALIDATION_FAILED":
      return L[kind].rejected;
    case "RATE_LIMITED":
      return E.rateLimited;
    case "CONFLICT":
      return E.conflict;
    // Chuyến đã huỷ (BE `INVALID_LOAD_TRANSITION`) / lô chưa giao (BE `SHIPMENT_STATE_CONFLICT`)
    case "INVALID_LOAD_TRANSITION":
      return kind === "waybill" ? L.waybill.stateConflict : E.unknown;
    case "SHIPMENT_STATE_CONFLICT":
      return kind === "pod" ? L.pod.stateConflict : E.unknown;
    case "LOAD_NOT_FOUND":
    case "SHIPMENT_NOT_FOUND":
    case "NOT_FOUND":
      return L[kind].notFound;
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return E.forbidden;
    case "NETWORK_ERROR":
      return E.network;
    case "STORAGE_ERROR":
      return E.unavailable;
    default:
      return error.status >= 500 ? E.unavailable : E.unknown;
  }
}

/** Mở link tải ngắn hạn: bấm một thẻ `<a>` tạm (link nói tên file nên trình duyệt lưu tại chỗ, không rời trang). Link không log. */
export function openDownloadLink(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
