/**
 * jsdom thiếu ResizeObserver / pointer capture / scrollIntoView mà cmdk (popover `Chọn cột hiển thị`) và Radix Select dùng.
 * Import để lấy tác dụng phụ (`import "@/test/jsdom-popover";`) trong test có mở các popover đó.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

export {};
