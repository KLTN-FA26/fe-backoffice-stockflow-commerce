/**
 * `requestId` của lần lập kế hoạch, nhớ trong sessionStorage (BE `CreateLoadPlanRequest.requestId`, idempotent): bấm lại
 * sau lỗi mạng / mất phản hồi gửi CÙNG id nên BE trả đúng kế hoạch đã tạo thay vì tạo kế hoạch thứ hai. Id gắn với nội
 * dung ý định (kho, lô, loại xe, chế độ, ghi chú): đổi nội dung thì sinh id mới — dùng lại id cũ cho nội dung khác sẽ
 * nhận về kế hoạch CŨ. Id bỏ đi khi lập thành công.
 */

import { STORAGE_KEYS } from "@/constants";

import type { CreatePlanInput } from "./plan-types";

interface StoredRequest {
  id: string;
  fingerprint: string;
}

/** Dự phòng khi sessionStorage bị chặn (cửa sổ riêng tư, chính sách trình duyệt). */
let fallback: StoredRequest | undefined;

function parseStored(raw: string | null): StoredRequest | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const id: unknown = Reflect.get(value, "id");
    const fingerprint: unknown = Reflect.get(value, "fingerprint");
    return typeof id === "string" && typeof fingerprint === "string"
      ? { id, fingerprint }
      : undefined;
  } catch {
    return undefined;
  }
}

function readStored(): StoredRequest | undefined {
  try {
    return parseStored(window.sessionStorage.getItem(STORAGE_KEYS.loadPlanRequest));
  } catch {
    return undefined;
  }
}

/** Dấu vân tay của ý định lập kế hoạch — cùng nội dung (kể cả thứ tự lô / loại xe khác) cho cùng chuỗi. */
export function createPlanFingerprint(intent: Omit<CreatePlanInput, "requestId">): string {
  return JSON.stringify([
    intent.warehouseId,
    [...intent.shipmentIds].sort(),
    [...intent.vehicleTypeIds].sort(),
    intent.selectionMode,
    intent.note?.trim() ?? "",
  ]);
}

/** Id cho ý định `fingerprint`: dùng lại id đã nhớ chỉ khi nội dung không đổi. */
export function createPlanRequestId(fingerprint: string): string {
  const stored = readStored() ?? fallback;
  const entry: StoredRequest =
    stored && stored.fingerprint === fingerprint
      ? stored
      : { id: crypto.randomUUID(), fingerprint };
  fallback = entry;
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.loadPlanRequest, JSON.stringify(entry));
  } catch {
    // sessionStorage không dùng được → chỉ còn bản trong bộ nhớ
  }
  return entry.id;
}

/** Quên id — gọi khi lập kế hoạch đã thành công (lần lập sau là kế hoạch khác). */
export function clearCreatePlanRequestId(): void {
  fallback = undefined;
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.loadPlanRequest);
  } catch {
    // không có sessionStorage → không còn gì để xoá
  }
}
