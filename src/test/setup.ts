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
