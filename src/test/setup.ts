/**
 * Test setup — runs before every test file.
 */

import "@testing-library/jest-dom/vitest";

/**
 * jsdom không cài `window.matchMedia` — polyfill tối thiểu để code đọc
 * `prefers-color-scheme` (theme-provider "system" mode) chạy được trong test.
 * Mặc định trả `matches: false` (light) trừ khi test tự stub lại.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * Polyfill jsdom cho popover / cmdk (`combobox-select`, menu "⋯" của dòng) — mọi select của back-office giờ là
 * combobox nên nạp chung cho mọi file test.
 */
import "./jsdom-popover";

/**
 * Chỗ đặt nút trên thanh breadcrumb (`HeaderActions` portal vào `#header-actions` của topbar). Test dựng trang lẻ không có
 * topbar → dựng sẵn chỗ đặt để nút "Tạo mới" vẫn có trong DOM.
 */
import { HEADER_ACTIONS_ID } from "@/components/shared/HeaderActions";

if (typeof document !== "undefined" && !document.getElementById(HEADER_ACTIONS_ID)) {
  const slot = document.createElement("div");
  slot.id = HEADER_ACTIONS_ID;
  document.body.appendChild(slot);
}

/**
 * jsdom không đo layout: ProseMirror (ô soạn mô tả Tiptap, `RichTextEditor`) gọi `getClientRects` /
 * `getBoundingClientRect` trên Range / Text và `document.elementFromPoint` khi đặt con trỏ, cuộn hay toggle định dạng.
 * Trả hình chữ nhật rỗng để test chạy, không báo lỗi không bắt.
 */
if (typeof window !== "undefined") {
  // DOMRectList không có constructor công khai trong jsdom: một danh sách rỗng đủ cho ProseMirror (chỉ đọc length / [0]).
  const emptyRects = (): DOMRectList =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getClientRects ??= emptyRects;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
  document.elementFromPoint ??= () => null;
}
