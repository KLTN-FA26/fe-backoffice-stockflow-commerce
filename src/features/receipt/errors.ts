/**
 * Goods receipt — map lỗi BE → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 *
 * Lỗi lưu kiểm đếm trả `fieldErrors` theo dòng (`lines[i].quantity`, SCRUM-464) và theo thùng
 * (`lines[i].packages[j].lpn`, SCRUM-473); mã lỗi của từng ô nằm ở `fieldCodes`.
 */

import {
  RECEIPT_CARTON_VALIDATION_MESSAGES,
  RECEIPT_DECISION_ERROR_MESSAGES,
  RECEIPT_ERROR_MESSAGES,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownErrorCode = Exclude<keyof typeof RECEIPT_ERROR_MESSAGES, "generic">;

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code !== "generic" && code in RECEIPT_ERROR_MESSAGES;
}

/** Câu tiếng Việt cho một lỗi bất kỳ khi thao tác với phiếu nhận. */
export function receiptErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isKnownErrorCode(error.code)) return RECEIPT_ERROR_MESSAGES[error.code];
    // BE đã dịch message sang tiếng Việt cho các lỗi chung còn lại
    if (error.message) return error.message;
  }
  return RECEIPT_ERROR_MESSAGES.generic;
}

/**
 * Lỗi khi Quản lý kho duyệt / từ chối phần vượt: `RECEIPT_PACKAGES_EXCEED_LINE` / `RECEIPT_LINE_HAS_PACKAGES` ở đây là
 * "cắt phần vượt đụng vào thùng đã dán nhãn", không phải lỗi kiểm đếm.
 */
export function receiptDecisionErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code in RECEIPT_DECISION_ERROR_MESSAGES) {
    return RECEIPT_DECISION_ERROR_MESSAGES[
      error.code as keyof typeof RECEIPT_DECISION_ERROR_MESSAGES
    ];
  }
  return receiptErrorMessage(error);
}

/** Lỗi do trạng thái phiếu / PO / thùng đã đổi ở nơi khác → màn hình nên tải lại dữ liệu. */
export function isStaleReceiptError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [
      "INVALID_RECEIPT_TRANSITION",
      "PURCHASE_ORDER_NOT_RECEIVABLE",
      "OPTIMISTIC_LOCK",
      // SCRUM-473: LPN không còn là thùng RECEIVING / IN_STOCK của dòng
      "STOCK_PACKAGE_NOT_FOUND",
      "INVALID_STOCK_PACKAGE_TRANSITION",
      "STOCK_PACKAGE_WRONG_LOCATION",
    ].includes(error.code)
  );
}

/**
 * Thùng trên form đã đổi ở nơi khác (bị huỷ, đã vào kho…) — SCRUM-473: gửi lại cùng danh sách LPN sẽ lỗi mãi, form
 * kiểm đếm phải nạp lại thùng từ phiếu mới.
 */
export function isStaleCartonError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["STOCK_PACKAGE_NOT_FOUND", "INVALID_STOCK_PACKAGE_TRANSITION"].includes(error.code)
  );
}

export interface ReceiptLineFieldError {
  /** Chỉ số dòng trong form kiểm đếm. */
  index: number;
  /** Đường dẫn trong dòng theo react-hook-form: `quantity`, `packages`, `packages.1.lpn`… */
  field: string;
  message: string;
}

const LINE_FIELD = /^lines\[(\d+)\]\.([\w.[\]]+)$/;

/** BE ghi câu tiếng Anh cho lỗi `VALIDATION_FAILED` của ô thùng — đổi sang câu tiếng Việt theo tên ô cuối. */
function fieldMessage(field: string, code: string | undefined, message: string): string {
  if (code && code !== "VALIDATION_FAILED" && isKnownErrorCode(code)) {
    return RECEIPT_ERROR_MESSAGES[code];
  }
  const leaf = field.split(".").at(-1) ?? "";
  if (code === "VALIDATION_FAILED" && (field === "unitOfMeasure" || field.startsWith("packages"))) {
    if (leaf in RECEIPT_CARTON_VALIDATION_MESSAGES) {
      return RECEIPT_CARTON_VALIDATION_MESSAGES[
        leaf as keyof typeof RECEIPT_CARTON_VALIDATION_MESSAGES
      ];
    }
  }
  return message || RECEIPT_ERROR_MESSAGES.VALIDATION_FAILED;
}

/** `fieldErrors` theo dòng (`lines[2].locationCode`, `lines[0].packages[1].lpn`) → lỗi theo dòng form. */
export function receiptLineFieldErrors(error: ApiError): ReceiptLineFieldError[] {
  return Object.entries(error.fieldErrors ?? {}).flatMap(([name, message]) => {
    const match = LINE_FIELD.exec(name);
    if (!match) return [];
    const [, index, raw] = match;
    const field = raw.replace(/\[(\d+)\]/g, ".$1");
    return [
      {
        index: Number(index),
        field,
        message: fieldMessage(field, error.fieldCodes?.[name], message),
      },
    ];
  });
}

/** Phần QC đã gửi: LPN theo đúng thứ tự trong `packages` (BE trỏ lỗi bằng chỉ số). */
interface SentQcParts {
  quarantined: { packages: readonly string[] } | null;
  rejected: { packages: readonly string[] } | null;
}

const QC_CARTON_FIELD = /^(quarantined|rejected)\.packages\[(\d+)\]$/;

/**
 * Lỗi theo thùng của kết luận QC (`quarantined.packages[0]` — SCRUM-473: không phải thùng của dòng, không ở khu QC,
 * hết hiệu lực) → LPN đã gửi ở vị trí đó + câu tiếng Việt theo mã.
 */
export function qcCartonFieldErrors(
  error: ApiError,
  sent: SentQcParts,
): { lpn: string; message: string }[] {
  return Object.entries(error.fieldErrors ?? {}).flatMap(([name, message]) => {
    const match = QC_CARTON_FIELD.exec(name);
    const part = match?.[1] === "quarantined" ? sent.quarantined : sent.rejected;
    const lpn = match ? part?.packages[Number(match[2])] : undefined;
    if (!lpn) return [];
    const code = error.fieldCodes?.[name] ?? error.code;
    return [{ lpn, message: isKnownErrorCode(code) ? RECEIPT_ERROR_MESSAGES[code] : message }];
  });
}
