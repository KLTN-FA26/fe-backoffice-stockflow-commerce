/**
 * Mobile breakpoint hook — usehooks-ts wrapper.
 *
 * Giữ nguyên contract cũ: trả về `boolean`, breakpoint 768px.
 * `initializeWithValue: false` để tránh hydration mismatch trong SSR (App Router).
 */

"use client";

import { useMediaQuery } from "usehooks-ts";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`, {
    defaultValue: false,
    initializeWithValue: false,
  });
}
