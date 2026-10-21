/**
 * `requestId` của lần hoàn tất đóng gói, nhớ theo task trong sessionStorage (BE PR #136
 * `PackingCompletionRequest.requestId`): bấm lại sau lỗi mạng / mất phản hồi gửi CÙNG id nên BE trả lại
 * lô đã tạo thay vì tạo lô thứ hai. Id chỉ bị bỏ khi lần hoàn tất đã tạo lô giao — lần giao một phần
 * kế tiếp cần id mới, nếu không BE sẽ trả lại lô cũ. Lệch thiết kế (200, chưa có lô) thì giữ id: BE
 * trả lời lần gửi lại đúng như cũ khi phiên còn bị giữ, và hoàn tất bình thường khi đã về PACKING.
 */

import { STORAGE_KEYS } from "@/constants";

/** Dự phòng khi sessionStorage bị chặn (cửa sổ riêng tư, chính sách trình duyệt) — mất khi tải lại trang. */
const fallback = new Map<string, string>();

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage không dùng được → chỉ còn bản trong bộ nhớ
  }
}

/** Id đang nhớ của task; chưa có thì sinh mới và nhớ lại. */
export function completionRequestId(taskId: string): string {
  const key = STORAGE_KEYS.packingCompletionRequest(taskId);
  const id = readStored(key) ?? fallback.get(key) ?? crypto.randomUUID();
  // Ghi lại cả hai nơi: bộ nhớ làm dự phòng, sessionStorage giữ qua lần tải lại trang
  fallback.set(key, id);
  writeStored(key, id);
  return id;
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
