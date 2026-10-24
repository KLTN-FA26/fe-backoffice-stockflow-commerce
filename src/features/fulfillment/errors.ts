/**
 * Fulfillment task — map lỗi BE → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 *
 * BE (FulfillmentServiceImpl) không có mã lỗi riêng: chỉ `NOT_FOUND` / `CONFLICT` /
 * `VALIDATION_FAILED` kèm message tiếng Anh không ổn định. Cùng một mã mang nghĩa khác nhau theo
 * endpoint, nên câu hiển thị tra theo NGỮ CẢNH thao tác.
 */

import { FULFILLMENT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

type MessageKey = keyof typeof FULFILLMENT_ERROR_MESSAGES;

export type FulfillmentErrorContext =
  "create" | "assign" | "pick" | "pack" | "reverify" | "artifact" | "candidates";

/**
 * Lỗi trạng thái của task / đơn: BE (FulfillmentServiceImpl, PickList, PickJpaEntity) trả
 * `PICK_TASK_STATE_CONFLICT` (409) — ở mọi thao tác trừ tải file thiết kế, cùng nghĩa với `CONFLICT` chung
 * nên dùng chung câu và cùng coi là "dữ liệu đã cũ". Tải file thiết kế: `CONFLICT` = lệch checksum
 * (DesignServiceImpl), `PICK_TASK_STATE_CONFLICT` = đơn đã rời khâu xuất kho (TaskAccess) — hai câu riêng.
 */
export const STATE_CONFLICT_CODE = "PICK_TASK_STATE_CONFLICT";

const BY_CONTEXT: Record<FulfillmentErrorContext, Readonly<Record<string, MessageKey>>> = {
  // 404 = không có đơn; 409 = đơn sai trạng thái / có dòng in chưa release sản xuất
  create: {
    NOT_FOUND: "orderNotFound",
    CONFLICT: "createConflict",
    VALIDATION_FAILED: "assigneeInvalid",
  },
  // 409 = pick không còn PENDING (PickJpaEntity#assign)
  assign: {
    NOT_FOUND: "notAssignee",
    CONFLICT: "assignConflict",
    VALIDATION_FAILED: "assigneeInvalid",
  },
  // 404 = không phải người được gán (kể cả quản lý kho); 409 = sai trạng thái pick / đơn đã đóng
  pick: { NOT_FOUND: "notAssignee", CONFLICT: "stale" },
  pack: { NOT_FOUND: "notAssignee", CONFLICT: "stale" },
  // 409 = pack không còn ON_HOLD, hoặc đơn đã rời khâu xuất kho
  reverify: { NOT_FOUND: "notAssignee", CONFLICT: "reverifyConflict" },
  // 404 = bundle không có vai trò file đó / dòng không có thiết kế; CONFLICT = lệch checksum;
  // PICK_TASK_STATE_CONFLICT = đơn đã rời khâu xuất kho
  artifact: {
    NOT_FOUND: "artifactMissing",
    CONFLICT: "artifactMismatch",
    [STATE_CONFLICT_CODE]: "artifactOrderClosed",
  },
  // GET /fulfillment/task-candidates: 403 FORBIDDEN (thiếu fulfillment-task-assignment:CREATE),
  // 403 OUT_OF_DATA_SCOPE (kho ngoài phạm vi), 404 WAREHOUSE_NOT_FOUND
  candidates: {
    FORBIDDEN: "candidatesForbidden",
    OUT_OF_DATA_SCOPE: "OUT_OF_DATA_SCOPE",
    WAREHOUSE_NOT_FOUND: "warehouseNotFound",
  },
};

function isMessageKey(code: string): code is MessageKey {
  return code in FULFILLMENT_ERROR_MESSAGES;
}

/** Câu tiếng Việt cho một lỗi khi thao tác với task xuất kho, theo ngữ cảnh thao tác. */
export function fulfillmentErrorMessage(error: unknown, context: FulfillmentErrorContext): string {
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  const code =
    error.code === STATE_CONFLICT_CODE && context !== "artifact" ? "CONFLICT" : error.code;
  const contextual = BY_CONTEXT[context][code];
  if (contextual) return FULFILLMENT_ERROR_MESSAGES[contextual];
  if (isMessageKey(code)) return FULFILLMENT_ERROR_MESSAGES[code];
  return FULFILLMENT_ERROR_MESSAGES.generic;
}

const STALE_CODES: readonly string[] = [
  "NOT_FOUND",
  "CONFLICT",
  STATE_CONFLICT_CODE,
  // Dòng đã lấy / báo thiếu / huỷ ở máy khác (BE PickList)
  "PICK_LINE_NOT_OPEN",
  // Hoàn tất khi BE còn dòng chưa lấy (dòng vừa lập / phân bổ lại ở máy khác)
  "PICK_LINES_INCOMPLETE",
  "OPTIMISTIC_LOCK",
];

/** Lỗi do task / đơn đã đổi ở nơi khác (hoặc task bị gán cho người khác) → nên tải lại dữ liệu. */
export function isStaleFulfillmentError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.includes(error.code);
}

/** Lọc / thao tác theo kho nằm ngoài phạm vi kho của người gọi — BE `WarehouseScope` → 403 OUT_OF_DATA_SCOPE. */
export function isOutOfDataScope(error: unknown): boolean {
  return error instanceof ApiError && error.code === "OUT_OF_DATA_SCOPE";
}
