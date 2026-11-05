/**
 * `requestId` của lần mở chuyến, nhớ trong sessionStorage (BE `OpenLoadRequest.requestId`): bấm lại sau
 * lỗi mạng / mất phản hồi gửi CÙNG id nên BE trả đúng chuyến đã mở thay vì mở chuyến thứ hai (kể cả hai
 * yêu cầu cùng lúc). Id gắn với nội dung ý định (kho, hãng, các lô, biển số, tài xế): đổi nội dung thì
 * sinh id mới — dùng lại id cũ cho nội dung khác sẽ nhận về chuyến CŨ. Id bỏ đi khi mở chuyến thành công.
 */

import { STORAGE_KEYS } from "@/constants";

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
    return parseStored(window.sessionStorage.getItem(STORAGE_KEYS.loadOpenRequest));
  } catch {
    return undefined;
  }
}

/** Dấu vân tay của ý định mở chuyến — cùng nội dung (kể cả thứ tự lô khác) cho cùng chuỗi. */
export function openLoadFingerprint(intent: {
  warehouseId: string;
  carrierId: string;
  shipmentIds?: readonly string[];
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
}): string {
  return JSON.stringify([
    intent.warehouseId,
    intent.carrierId,
    [...(intent.shipmentIds ?? [])].sort(),
    intent.vehiclePlate ?? "",
    intent.driverName ?? "",
    intent.driverPhone ?? "",
  ]);
}

/** Id cho ý định `fingerprint`: dùng lại id đã nhớ chỉ khi nội dung không đổi. */
export function openLoadRequestId(fingerprint: string): string {
  const stored = readStored() ?? fallback;
  const entry: StoredRequest =
    stored && stored.fingerprint === fingerprint
      ? stored
      : { id: crypto.randomUUID(), fingerprint };
  fallback = entry;
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.loadOpenRequest, JSON.stringify(entry));
  } catch {
    // sessionStorage không dùng được → chỉ còn bản trong bộ nhớ
  }
  return entry.id;
}

/** Quên id — gọi khi mở chuyến đã thành công (lần mở sau là chuyến khác). */
export function clearOpenLoadRequestId(): void {
  fallback = undefined;
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.loadOpenRequest);
  } catch {
    // không có sessionStorage → không còn gì để xoá
  }
}
