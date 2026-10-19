/**
 * Di chuyển nội bộ — mapping lỗi API sang thông điệp hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, `common/error/ErrorCode.java`), KHÔNG theo
 * `error.message` — message server là tiếng Anh. Mã lạ → rơi về theo HTTP status.
 */

import { MOVE_ERROR_MESSAGES, MOVE_ERROR_TITLES, MOVE_MESSAGES } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import type { MoveCreateInput } from "./types";

export type MoveErrorKind =
  "not-found" | "forbidden" | "conflict" | "validation" | "contract" | "network" | "server";

export interface MoveErrorView {
  kind: MoveErrorKind;
  title: string;
  detail: string;
  traceId?: string;
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

function known(code: string): Omit<MoveErrorView, "traceId"> | null {
  switch (code) {
    // relocate(): a move needs two different locations / hợp lệ theo @Valid — 400.
    case "VALIDATION_FAILED":
      return view("validation", M.validation);
    // Docs 11 BR-01 — 409, the two codes name different warehouses.
    case "MOVE_ACROSS_WAREHOUSES":
      return view("conflict", M.crossWarehouse);
    // relocate(): destination UNKNOWN — 404.
    case "LOCATION_NOT_FOUND":
      return view("not-found", M.locationNotFound);
    // relocate(): destination, its shelf or its warehouse is not active — 409.
    case "LOCATION_NOT_USABLE":
      return view("conflict", M.locationNotUsable);
    // relocate(): no stock row of SKU (and lot) at the source — 404.
    case "STOCK_ITEM_NOT_FOUND":
      return view("not-found", M.stockItemNotFound);
    // StockItem.moveOut: only unreserved units move — 409.
    case "INSUFFICIENT_STOCK":
      return view("conflict", M.insufficientStock);
    // relocate(): destination holds this lot in another status — 409.
    case "STOCK_STATUS_MISMATCH":
      return view("conflict", M.statusMismatch);
    // findOne (several layers) / destination cannot merge — 409.
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return view("conflict", M.policyConflict);
    // WarehouseScope.requireLocation — 403.
    case "OUT_OF_DATA_SCOPE":
      return view("forbidden", M.outOfScope);
    case "OPTIMISTIC_LOCK":
      return view("conflict", M.concurrent);
    case "INVALID_MOVE_CONTRACT":
      return view("contract", FALLBACK.contract);
    case "NETWORK_ERROR":
      return view("network", FALLBACK.network);
    default:
      return null;
  }
}

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
  const mapped = known(error.code);
  if (mapped) return { ...mapped, traceId: error.traceId };
  const kind = kindOfStatus(error.status);
  return { ...view(kind, FALLBACK[kind]), traceId: error.traceId };
}

// Server `fieldErrors` (BE @Valid, English text) → the form field they belong to, with our own
// Vietnamese wording. Only fields the form has are returned.
const FIELD_MESSAGES: Record<keyof MoveCreateInput, string> = {
  sku: MOVE_MESSAGES.invalidSku,
  lotNumber: M.validation,
  fromLocation: MOVE_MESSAGES.required,
  toLocation: MOVE_MESSAGES.required,
  quantity: MOVE_MESSAGES.quantity,
};

export function moveFieldErrors(error: unknown): Partial<Record<keyof MoveCreateInput, string>> {
  if (!(error instanceof ApiError) || !error.fieldErrors) return {};
  const result: Partial<Record<keyof MoveCreateInput, string>> = {};
  for (const field of Object.keys(FIELD_MESSAGES) as Array<keyof MoveCreateInput>) {
    if (error.fieldErrors[field]) result[field] = FIELD_MESSAGES[field];
  }
  return result;
}
