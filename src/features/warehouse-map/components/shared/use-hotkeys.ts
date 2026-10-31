"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Tổ hợp phím → việc cần làm. Tên tổ hợp: `mod+s`, `mod+shift+z`, `shift+tab`, `arrowleft`, `?`, `+`.
 * Handler trả `false` = không xử lý lần bấm này (để trình duyệt làm việc mặc định, vd Tab chuyển focus).
 */
export type HotkeyMap = Partial<Record<string, (event: KeyboardEvent) => boolean | void>>;

/**
 * Tên tổ hợp của một lần bấm: Ctrl (Windows) và ⌘ (macOS) đều là `mod`; ký tự không phải chữ / số
 * (`?`, `+`, `-`) bỏ Shift vì bàn phím khác nhau cần Shift khác nhau để gõ ra chúng.
 */
export function comboOf(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  const symbol = event.key.length === 1 && !/[a-z0-9]/i.test(event.key);
  return [
    (event.ctrlKey || event.metaKey) && "mod",
    event.altKey && "alt",
    event.shiftKey && !symbol && "shift",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

/** Đang gõ trong ô nhập, thao tác trong dialog / danh sách chọn → phím thuộc về chỗ đó, không phải bản đồ. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[role=dialog], [role=listbox], [role=menu]")) return true;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Gắn phím tắt cho bản đồ khi `enabled`. Phím trùng thao tác mặc định của nút đang focus (Enter, Space)
 * thì nhường nút đó. `allowWhileTyping`: tổ hợp vẫn chạy khi đang gõ (vd `mod+s` lưu).
 */
export function useHotkeys(
  map: HotkeyMap,
  {
    enabled = true,
    allowWhileTyping = [],
  }: { enabled?: boolean; allowWhileTyping?: string[] } = {},
): void {
  // Đọc `map` mới nhất lúc bấm — caller dựng map mới mỗi render, không gắn lại listener theo nó
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const combo = comboOf(event);
    const handler = map[combo];
    if (!handler) return;
    if (isTyping(event.target) && !allowWhileTyping.includes(combo)) return;
    const onButton = event.target instanceof HTMLElement && event.target.closest("button, a");
    if (onButton && (combo === "enter" || combo === " ")) return;
    if (handler(event) !== false) event.preventDefault();
  });
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}
