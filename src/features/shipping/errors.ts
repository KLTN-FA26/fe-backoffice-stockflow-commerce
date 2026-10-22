/**
 * Shipping — map errorCode BE (PR #137 + mã chung) → câu tiếng Việt, và phân loại lỗi cho màn quét /
 * bàn giao (dữ liệu cũ → tải lại; lỗi tạm thời → gửi lại cùng id; lô nào chặn bàn giao).
 */

import {
  ADMIN_ROUTES,
  SHIPPING_ERROR_MESSAGES,
  SHIPPING_WRONG_VEHICLE_MESSAGE,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownErrorCode = Exclude<keyof typeof SHIPPING_ERROR_MESSAGES, "generic" | "shipmentRefused">;

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return (
    code !== "generic" && code !== "shipmentRefused" && Object.hasOwn(SHIPPING_ERROR_MESSAGES, code)
  );
}

/** Mã lô giao mà BE nêu tên trong lỗi bàn giao (`fieldErrors.shipmentCode`). */
export function shipmentCodeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.fieldErrors?.shipmentCode : undefined;
}

/**
 * Chuyến nguyên xe: kiện đã được kế hoạch xếp lên xe khác → BE 409 PACKAGE_NOT_IN_LOAD kèm `vehicleSeq` và
 * `loadCode` của xe đúng (BE PR #162). Thiếu một trong hai thì không nêu được xe → câu chung.
 */
export function wrongVehicleOf(error: unknown): { seq: string; loadCode: string } | undefined {
  if (!(error instanceof ApiError) || error.code !== "PACKAGE_NOT_IN_LOAD") return undefined;
  const seq = error.fieldErrors?.vehicleSeq;
  const loadCode = error.fieldErrors?.loadCode;
  return seq && loadCode ? { seq, loadCode } : undefined;
}

/**
 * Câu tiếng Việt cho lỗi; BE nêu tên lô giao thì thêm tiền tố "Lô <mã>". BE gắn `shipmentCode` vào MỌI
 * lỗi phía đơn khi bàn giao (đơn huỷ, lô xung đột, vượt số lượng…): mã chưa biết mà có tên lô vẫn nói
 * được lô nào bị chặn, kèm lý do chung.
 */
export function shippingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return SHIPPING_ERROR_MESSAGES.generic;
  const wrongVehicle = wrongVehicleOf(error);
  if (wrongVehicle) {
    return SHIPPING_WRONG_VEHICLE_MESSAGE.replace("{seq}", wrongVehicle.seq).replace(
      "{code}",
      wrongVehicle.loadCode,
    );
  }
  const shipmentCode = shipmentCodeOf(error);
  if (!isKnownErrorCode(error.code)) {
    return shipmentCode
      ? `Lô ${shipmentCode}: ${SHIPPING_ERROR_MESSAGES.shipmentRefused}`
      : SHIPPING_ERROR_MESSAGES.generic;
  }
  const message = SHIPPING_ERROR_MESSAGES[error.code];
  return shipmentCode ? `Lô ${shipmentCode}: ${message}` : message;
}

/** Lỗi dỡ kiện: 409 PACKAGE_NOT_IN_LOAD ở đây nghĩa là kiện không nằm trong danh sách cần dỡ của xe này. */
export function unloadErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code === "PACKAGE_NOT_IN_LOAD"
    ? UI_LABELS.shipping.ftl.unload.notPending
    : shippingErrorMessage(error);
}

/** Mã lỗi cho biết dữ liệu hiển thị đã cũ (người khác đã đổi chuyến / lô) → tải lại. */
const STALE_CODES: ReadonlySet<string> = new Set([
  "INVALID_LOAD_TRANSITION",
  // BE PR #162: kế hoạch đã đổi trạng thái / còn kiện cần dỡ mà màn chưa thấy → tải lại chuyến
  "INVALID_LOAD_PLAN_TRANSITION",
  "LOAD_UNLOAD_PENDING",
  "OPTIMISTIC_LOCK",
  "LOAD_NOT_FULLY_LOADED",
  "LOAD_EMPTY",
  "LOAD_NOT_FOUND",
  "SHIPMENT_NOT_FOUND",
  "SHIPMENT_STATE_CONFLICT",
  "SHIPMENT_ON_ANOTHER_LOAD",
  "SHIPMENT_NOT_FOR_LOAD",
  "SHIPMENT_OTHER_CARRIER",
  "PACKAGE_NOT_READY",
  "CARRIER_INACTIVE",
]);

/** Trạng thái chuyến / lô đã đổi ở nơi khác (máy quét khác, người khác bàn giao) → tải lại. */
export function isStaleLoadError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}

/**
 * Lỗi tạm thời: yêu cầu có thể ĐÃ tới BE (mất mạng, 5xx, phản hồi sai hợp đồng). Quét lại cùng mã thì
 * dùng lại `scanId` — BE trả đúng kết quả lần trước thay vì ghi hai lần. Lỗi 4xx là câu trả lời dứt
 * khoát → lần quét sau dùng `scanId` mới.
 */
export function isTransientError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

/**
 * Lỗi làm mọi mã còn trong hàng đợi quét chắc chắn thất bại theo cùng một cách (chuyến không còn
 * LOADING / không còn tồn tại, mất quyền, mất mạng) → dừng hàng đợi thay vì gửi tiếp từng mã.
 */
export function isScanQueueFatal(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return (
    error.status === 0 ||
    error.status === 401 ||
    error.status === 403 ||
    ["INVALID_LOAD_TRANSITION", "LOAD_NOT_FOUND", "OUT_OF_DATA_SCOPE"].includes(error.code)
  );
}

/** Lô giao chặn việc bàn giao cả chuyến (BE `DispatchService.handOver` nêu tên lô). */
export interface HandoverRefusal {
  code: string;
  shipmentCode?: string;
  message: string;
  /** Nhãn kiện lệch COD (BR-04): in lại nhãn ở trạm đóng gói rồi ký lại. */
  reprintLabel: boolean;
}

/**
 * Lỗi bàn giao có nêu tên lô (`fieldErrors.shipmentCode`) → dữ liệu để đánh dấu đúng lô trên màn chuyến.
 * BE gắn tên lô vào mọi từ chối phía đơn nên không giới hạn theo mã lỗi; chỉ lỗi KHÔNG nêu lô (hết hạn
 * khoá, chưa ký…) mới không đánh dấu lô nào.
 */
export function handoverRefusalOf(error: unknown): HandoverRefusal | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const shipmentCode = shipmentCodeOf(error);
  if (!shipmentCode) return undefined;
  return {
    code: error.code,
    shipmentCode,
    message: shippingErrorMessage(error),
    reprintLabel: error.code === "LABEL_OUTDATED",
  };
}

/**
 * Nơi in lại nhãn kiện: trạm đóng gói của đơn (endpoint nhãn ghi nhận lần in) khi BE trả `taskId` của
 * lô; chưa có thì danh sách task, từ task của đơn vào Đóng gói.
 */
export function reprintLabelHref(taskId?: string | null): string {
  return taskId ? ADMIN_ROUTES.packing.detail(taskId) : ADMIN_ROUTES.picking.list;
}
