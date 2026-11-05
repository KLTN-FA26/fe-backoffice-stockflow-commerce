/**
 * `requestId` của lần hoàn tất đóng gói, nhớ theo task trong sessionStorage (BE PR #136
 * `PackingCompletionRequest.requestId`): bấm lại sau lỗi mạng / mất phản hồi gửi CÙNG id nên BE trả lại
 * lô đã tạo thay vì tạo lô thứ hai. NHƯNG BE trả lô tìm được theo id mà không xét nội dung: nếu lần
 * trước đã tạo lô (phản hồi bị mất) rồi người đóng đóng thêm kiện, gửi lại id cũ sẽ báo thành công với
 * lô CŨ và kiện mới không bao giờ được giao. Vì vậy id được lưu kèm tập kiện niêm phong chưa giao lúc
 * hoàn tất và chỉ dùng lại khi tập đó không đổi; đổi (thêm / mở lại / huỷ kiện) thì sinh id mới. Id
 * cũng bỏ khi lần hoàn tất đã tạo lô giao. Lệch thiết kế (200, chưa có lô) giữ id, tập kiện không đổi.
 */

import { STORAGE_KEYS } from "@/constants";

interface StoredRequest {
  id: string;
  /** Các `packageId` niêm phong chưa giao lúc tạo id, đã sắp xếp, nối bằng dấu phẩy. */
  packages: string;
}

/** Dự phòng khi sessionStorage bị chặn (cửa sổ riêng tư, chính sách trình duyệt) — mất khi tải lại trang. */
const fallback = new Map<string, StoredRequest>();

function parseStored(raw: string | null): StoredRequest | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const id: unknown = Reflect.get(value, "id");
    const packages: unknown = Reflect.get(value, "packages");
    return typeof id === "string" && typeof packages === "string" ? { id, packages } : undefined;
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
 * Id hoàn tất của task cho đúng tập kiện niêm phong chưa giao `sealedPackageIds`: dùng lại id đã nhớ
 * chỉ khi tập kiện không đổi, còn lại sinh id mới và nhớ lại.
 */
export function completionRequestId(taskId: string, sealedPackageIds: readonly string[]): string {
  const key = STORAGE_KEYS.packingCompletionRequest(taskId);
  const packages = [...sealedPackageIds].sort().join(",");
  const stored = parseStored(readStored(key)) ?? fallback.get(key);
  const entry: StoredRequest =
    stored && stored.packages === packages ? stored : { id: crypto.randomUUID(), packages };
  // Ghi lại cả hai nơi: bộ nhớ làm dự phòng, sessionStorage giữ qua lần tải lại trang
  fallback.set(key, entry);
  writeStored(key, entry);
  return entry.id;
}

/** Quên id của task — gọi khi lần hoàn tất đã tạo lô giao. */
export function clearCompletionRequestId(taskId: string): void {
  const key = STORAGE_KEYS.packingCompletionRequest(taskId);
  fallback.delete(key);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // không có sessionStorage → không còn gì để xoá
  }
}
