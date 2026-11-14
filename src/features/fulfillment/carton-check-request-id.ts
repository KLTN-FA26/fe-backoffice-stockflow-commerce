/**
 * `requestId` của lần hoàn tất kiểm thùng, nhớ theo task trong sessionStorage (BE `PackingCompletionRequest.requestId`):
 * bấm lại sau lỗi mạng / mất phản hồi gửi CÙNG id nên BE trả lại shipment đã tạo thay vì tạo shipment thứ hai. NHƯNG BE
 * trả shipment tìm được theo id mà không xét nội dung: nếu lần trước đã tạo shipment (phản hồi bị mất) rồi người kiểm
 * dán nhãn thêm thùng, gửi lại id cũ sẽ báo thành công với shipment CŨ và thùng mới không bao giờ được giao. Vì vậy id
 * được lưu kèm tập thùng đã dán nhãn chưa vào shipment lúc hoàn tất và chỉ dùng lại khi tập đó không đổi; đổi (dán
 * nhãn thêm / loại thùng) thì sinh id mới. Id cũng bỏ khi lần hoàn tất đã tạo shipment.
 */

import { STORAGE_KEYS } from "@/constants";

interface StoredRequest {
  id: string;
  /** Các LPN đã dán nhãn chưa vào shipment lúc tạo id, đã sắp xếp, nối bằng dấu phẩy. */
  cartons: string;
}

/** Dự phòng khi sessionStorage bị chặn (cửa sổ riêng tư, chính sách trình duyệt) — mất khi tải lại trang. */
const fallback = new Map<string, StoredRequest>();

function parseStored(raw: string | null): StoredRequest | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const id: unknown = Reflect.get(value, "id");
    const cartons: unknown = Reflect.get(value, "cartons");
    return typeof id === "string" && typeof cartons === "string" ? { id, cartons } : undefined;
  } catch {
    return undefined;
  }
}

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredRequest): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage không dùng được → chỉ còn bản trong bộ nhớ
  }
}

/**
 * Id hoàn tất của task cho đúng tập thùng `lpns` (đã dán nhãn, chưa vào shipment): dùng lại id đã nhớ chỉ khi tập
 * thùng không đổi, còn lại sinh id mới và nhớ lại.
 */
export function completionRequestId(taskId: string, lpns: readonly string[]): string {
  const key = STORAGE_KEYS.packingCompletionRequest(taskId);
  const cartons = [...lpns].sort().join(",");
  const stored = parseStored(readStored(key)) ?? fallback.get(key);
  const entry: StoredRequest =
    stored && stored.cartons === cartons ? stored : { id: crypto.randomUUID(), cartons };
  // Ghi lại cả hai nơi: bộ nhớ làm dự phòng, sessionStorage giữ qua lần tải lại trang
  fallback.set(key, entry);
  writeStored(key, entry);
  return entry.id;
}

/** Quên id của task — gọi khi lần hoàn tất đã tạo shipment. */
export function clearCompletionRequestId(taskId: string): void {
  const key = STORAGE_KEYS.packingCompletionRequest(taskId);
  fallback.delete(key);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // không có sessionStorage → không còn gì để xoá
  }
}
