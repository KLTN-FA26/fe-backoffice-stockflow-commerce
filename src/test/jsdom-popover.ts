/**
 * jsdom thiếu ResizeObserver / pointer capture / scrollIntoView mà cmdk (popover `Ẩn hiện cột`) và Radix Select dùng.
 * Import để lấy tác dụng phụ (`import "@/test/jsdom-popover";`) trong test có mở các popover đó.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// Test chạy môi trường node (không có DOM) cũng nạp setup chung → chỉ vá khi có `Element`.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

export {};
