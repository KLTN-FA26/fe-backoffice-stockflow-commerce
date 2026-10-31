/**
 * Transfer order — map lỗi BE → câu tiếng Việt (quy ước đã chốt: mọi lỗi hiển thị tiếng Việt).
 *
 * BE trả lỗi nghiệp vụ qua `errorCode` kèm detail tiếng Anh (GlobalExceptionHandler) — FE rẽ nhánh
 * theo `errorCode`, không hiện detail thô. Chỉ lỗi `@Valid` mới có `fieldErrors` (`lines[0].sku`).
 */

import { TRANSFER_ERROR_MESSAGES, TRANSFER_FIELD_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

/** Khoá không phải errorCode BE — câu dự phòng của FE. */
// Câu dự phòng của FE — không phải errorCode BE
const FALLBACK_KEYS = ["generic", "validationGeneral", "validationDispatch"] as const;
type KnownErrorCode = Exclude<keyof typeof TRANSFER_ERROR_MESSAGES, (typeof FALLBACK_KEYS)[number]>;

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return (
    !(FALLBACK_KEYS as readonly string[]).includes(code) &&
    Object.hasOwn(TRANSFER_ERROR_MESSAGES, code)
  );
}

/** BE InsufficientStockException: "Insufficient stock for SKU X: requested N, available M". */
const INSUFFICIENT_DETAIL = /SKU (\S+): requested (\d+), available (\d+)/;

export interface InsufficientStockDetail {
  sku: string;
  requested: number;
  available: number;
}

/** SKU + SL của lỗi thiếu tồn (đọc từ message BE) — để chỉ ra đúng dòng cần sửa. */
export function insufficientStockDetail(error: unknown): InsufficientStockDetail | null {
  if (!(error instanceof ApiError) || error.code !== "INSUFFICIENT_STOCK") return null;
  const match = INSUFFICIENT_DETAIL.exec(error.message);
  if (!match) return null;
  const [, sku = "", requested = "0", available = "0"] = match;
  return { sku, requested: Number(requested), available: Number(available) };
}

/** Khoá `fieldErrors` theo dòng của BE: `lines[i].field`. */
const LINE_FIELD = /^lines\[(\d+)\]\.(\w+)$/;

/**
 * Câu tiếng Việt cho lỗi thao tác lệnh. Thiếu tồn: tạo / sửa / xuất kho đều đi qua
 * `StockAllocator.plan` — báo tổng SL cần / khả dụng của đúng dòng (SKU, lọc theo lô).
 */
export function transferErrorMessage(error: unknown): string {
  const stock = insufficientStockDetail(error);
  if (stock) {
    // Nói rõ SKU nào thiếu — câu chung không cho biết cần sửa dòng nào
    return `${TRANSFER_ERROR_MESSAGES.INSUFFICIENT_STOCK} SKU ${stock.sku}: cần ${stock.requested}, khả dụng ${stock.available}.`;
  }
  // VALIDATION_FAILED không chỉ ra dòng nào (lỗi nghiệp vụ trong domain, hoặc chỉ lỗi phần đầu như
  // `lines` @NotEmpty) → không có ô nào được đánh dấu, đừng bảo người dùng "xem ô được đánh dấu"
  if (
    error instanceof ApiError &&
    error.code === "VALIDATION_FAILED" &&
    !Object.keys(error.fieldErrors ?? {}).some((name) => LINE_FIELD.test(name))
  ) {
    return TRANSFER_ERROR_MESSAGES.validationGeneral;
  }
  if (error instanceof ApiError && isKnownErrorCode(error.code)) {
    return TRANSFER_ERROR_MESSAGES[error.code];
  }
  return TRANSFER_ERROR_MESSAGES.generic;
}

/** Lỗi do lệnh đã đổi ở nơi khác → tải lại lệnh trước khi người dùng thao tác tiếp. */
export function isStaleTransferError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [
      "INVALID_TRANSFER_TRANSITION",
      "OPTIMISTIC_LOCK",
      "TRANSFER_ORDER_NOT_EDITABLE",
      // SCRUM-287 PR F9: lệnh đã được đóng gói / xe đầu đã ký nhận ở nơi khác → tải lại để nút đúng trạng thái
      "TRANSFER_GOODS_LEFT",
      "TRANSFER_DISPATCH_BY_LOAD_PLAN",
      "LOAD_PLAN_LOADING_STARTED",
      "TRANSFER_LOADING_IN_PROGRESS",
      "PACKAGE_UNLOAD_PENDING",
    ].includes(error.code)
  );
}

export interface TransferLineFieldError {
  index: number;
  field: string;
  message: string;
}

/** `fieldErrors` của `@Valid CreateTransferOrderRequest` → lỗi theo dòng form (trừ thiếu tồn). */
export function transferLineFieldErrors(error: ApiError): TransferLineFieldError[] {
  if (error.code === "INSUFFICIENT_STOCK") return [];
  return Object.keys(error.fieldErrors ?? {}).flatMap((name) => {
    const match = LINE_FIELD.exec(name);
    if (!match) return [];
    const [, index, field] = match;
    return [{ index: Number(index), field, message: TRANSFER_ERROR_MESSAGES.VALIDATION_FAILED }];
  });
}

const AVAILABLE_IN_MESSAGE = /available (\d+)/;

interface StockLine {
  sku: string;
  lotNumber?: string | null;
  /** Dòng không trừ tồn (xuất 0) → không bao giờ là dòng thiếu. */
  skip?: boolean;
}

/**
 * Lỗi thiếu tồn gắn vào TỪNG DÒNG (chỉ số dòng → câu hiển thị). Tồn khả dụng BE tính theo SKU + lô
 * của một dòng (TransferOrderServiceImpl#candidates), nên phải đánh dấu đúng dòng, đúng lô.
 *
 * 1. Đề xuất cho BE (đã note): `INSUFFICIENT_STOCK` kèm `fieldErrors[]` cho MỌI dòng thiếu — field
 *    `lines[i].quantity` (tạo / sửa) hoặc `lines[i].shippedQuantity` (xuất kho), `i` = vị trí trong
 *    body request, `code` = null để GlobalExceptionHandler giữ nguyên message `requested N, available M`.
 *    Có thì dùng đúng dòng BE chỉ ra.
 * 2. BE hiện tại chỉ trả SKU trong message (không có lô / dòng) → dự phòng: các dòng cùng SKU.
 *    Đúng MỘT dòng khớp thì kèm số khả dụng; nhiều dòng (khác lô) thì không gắn số vì không biết số
 *    đó thuộc lô nào.
 */
export function stockErrorsByLine(
  error: unknown,
  lines: readonly StockLine[],
  field: "quantity" | "shippedQuantity",
): Record<number, string> {
  if (!(error instanceof ApiError) || error.code !== "INSUFFICIENT_STOCK") return {};
  const label = (available: string | undefined) =>
    available !== undefined
      ? `${TRANSFER_FIELD_MESSAGES.notEnoughStock} ${available}`
      : TRANSFER_FIELD_MESSAGES.notEnoughStockNoQty;

  const byLine: Record<number, string> = {};
  for (const [name, message] of Object.entries(error.fieldErrors ?? {})) {
    const match = LINE_FIELD.exec(name);
    if (match && match[2] === field) {
      byLine[Number(match[1])] = label(AVAILABLE_IN_MESSAGE.exec(message)?.[1]);
    }
  }
  if (Object.keys(byLine).length > 0) return byLine;

  const stock = insufficientStockDetail(error);
  if (!stock) return {};
  const matching = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !line.skip && line.sku.trim().toUpperCase() === stock.sku.toUpperCase());
  for (const { index } of matching) {
    byLine[index] = label(matching.length === 1 ? String(stock.available) : undefined);
  }
  return byLine;
}
