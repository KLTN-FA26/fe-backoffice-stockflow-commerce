/**
 * Di chuyển nội bộ — mapping lỗi API sang thông điệp hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, `common/error/ErrorCode.java`), KHÔNG theo
 * `error.message` — message server là tiếng Anh. Mã lạ → rơi về theo HTTP status.
 */

import { MOVE_ERROR_MESSAGES, MOVE_ERROR_TITLES, MOVE_MESSAGES } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import { moveErrorDetailsDto } from "./schemas";

import type { MoveCreateInput } from "./types";

export type MoveErrorKind =
  "not-found" | "forbidden" | "conflict" | "validation" | "contract" | "network" | "server";

export interface MoveErrorView {
  kind: MoveErrorKind;
  title: string;
  detail: string;
  traceId?: string;
  /** Thùng gây lỗi khi BE nêu (`details.lpn`) — để đánh dấu đúng dòng trong danh sách. */
  lpn?: string;
}

const M = MOVE_ERROR_MESSAGES;

const FALLBACK: Record<MoveErrorKind, string> = {
  "not-found": M.notFound,
  forbidden: M.forbidden,
  conflict: M.conflict,
  validation: M.validation,
  contract: MOVE_MESSAGES.invalidContract,
  network: M.network,
  server: M.server,
};

function view(kind: MoveErrorKind, detail: string): Omit<MoveErrorView, "traceId"> {
  const title = kind === "network" ? MOVE_ERROR_TITLES.network : MOVE_ERROR_TITLES.failed;
  return { kind, title, detail };
}

// BE StockOperationsServiceImpl.relocatePackages (MOVE_TASK) — mã nào, lúc nào.
const KNOWN: Record<string, Omit<MoveErrorView, "traceId">> = {
  // @Valid, hoặc một thùng đã ở sẵn vị trí đích (requireMovableBetween) — 400 / 422.
  VALIDATION_FAILED: view("validation", M.validation),
  // Một LPN không tồn tại — 404.
  STOCK_PACKAGE_NOT_FOUND: view("not-found", M.cartonNotFound),
  // Docs 11 BR-05 — 409: thùng đang giữ cho đơn.
  STOCK_PACKAGE_HELD: view("conflict", M.cartonHeld),
  // Docs 11 BR-06 — 409: thùng hoặc vị trí đích đang kiểm kê.
  STOCK_SLOT_UNDER_COUNT: view("conflict", M.slotUnderCount),
  // Docs 11 BR-04 — 409: thùng không ở IN_STOCK.
  INVALID_STOCK_PACKAGE_TRANSITION: view("conflict", M.cartonNotInStock),
  // Docs 11 BR-01 — 409.
  MOVE_ACROSS_WAREHOUSES: view("conflict", M.crossWarehouse),
  // Docs 11 BR-09 — 409: nguồn hoặc đích là khu tập kết.
  STAGING_MOVE_NOT_ALLOWED: view("conflict", M.staging),
  // Docs 06 BR-01, 11 BR-10 — 422: đích là bin và thùng không vừa.
  CARTON_DOES_NOT_FIT_BIN: view("validation", M.doesNotFit),
  // Docs 20 BR-21 (requireQuarantineByDecision) — 409.
  STOCK_PACKAGE_QUARANTINED: view("conflict", M.quarantined),
  LOCATION_AREA_MISMATCH: view("conflict", M.areaMismatch),
  STOCK_STATUS_MISMATCH: view("conflict", M.statusMismatch),
  // requireUsable(): đích UNKNOWN — 404; đích / kệ / kho không hoạt động — 409.
  LOCATION_NOT_FOUND: view("not-found", M.locationNotFound),
  LOCATION_NOT_USABLE: view("conflict", M.locationNotUsable),
  // 422: cùng requestId, khác danh sách thùng hoặc khác đích.
  IDEMPOTENCY_KEY_REUSED: view("validation", M.idempotencyReused),
  // WarehouseScope.requireLocation — 403.
  OUT_OF_DATA_SCOPE: view("forbidden", M.outOfScope),
  OPTIMISTIC_LOCK: view("conflict", M.concurrent),
  INVALID_MOVE_CONTRACT: view("contract", FALLBACK.contract),
  NETWORK_ERROR: view("network", FALLBACK.network),
};

function kindOfStatus(status: number): MoveErrorKind {
  if (status === 0) return "network";
  if (status === 400 || status === 422) return "validation";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  return "server";
}

export function moveErrorView(error: unknown): MoveErrorView {
  if (!(error instanceof ApiError)) return { ...view("server", FALLBACK.server) };
  const lpn = moveErrorDetailsDto.safeParse(error.details ?? {}).data?.lpn;
  const mapped =
    KNOWN[error.code] ?? view(kindOfStatus(error.status), FALLBACK[kindOfStatus(error.status)]);
  return { ...mapped, traceId: error.traceId, ...(lpn ? { lpn } : {}) };
}

/** Lệnh gửi lại cùng requestId nhưng khác nội dung — cần một id mới trước khi gửi tiếp. */
export function isIdempotencyReused(error: unknown): boolean {
  return error instanceof ApiError && error.code === "IDEMPOTENCY_KEY_REUSED";
}

// Server `fieldErrors` (BE @Valid, English text) → the form field they belong to, with our own Vietnamese wording.
// BE names an element of the list as `lpns[3]`: every `lpns…` key belongs to the carton list.
const FIELD_MESSAGES: Record<keyof MoveCreateInput, string> = {
  lpns: M.validation,
  toLocation: MOVE_MESSAGES.required,
};

export function moveFieldErrors(error: unknown): Partial<Record<keyof MoveCreateInput, string>> {
  if (!(error instanceof ApiError) || !error.fieldErrors) return {};
  const fields = Object.keys(error.fieldErrors);
  const result: Partial<Record<keyof MoveCreateInput, string>> = {};
  for (const field of Object.keys(FIELD_MESSAGES) as Array<keyof MoveCreateInput>) {
    if (fields.some((name) => name === field || name.startsWith(`${field}[`))) {
      result[field] = FIELD_MESSAGES[field];
    }
  }
  return result;
}
