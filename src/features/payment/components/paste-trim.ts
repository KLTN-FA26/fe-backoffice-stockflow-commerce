import type { ClipboardEvent } from "react";

/**
 * Dán vào ô mã sao kê: bỏ khoảng trắng / xuống dòng đầu và cuối của chữ dán (sao chép từ file sao kê hay mang theo) rồi
 * chèn vào chỗ con trỏ (S07-4). `apply` nhận giá trị mới của ô. Chữ dán không có gì để cắt thì để trình duyệt dán như cũ.
 */
export function pasteTrimmed(
  event: ClipboardEvent<HTMLInputElement>,
  apply: (value: string) => void,
): void {
  const raw = event.clipboardData.getData("text");
  const text = raw.trim();
  if (text === raw) return;
  event.preventDefault();
  const input = event.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  apply(input.value.slice(0, start) + text + input.value.slice(end));
}
