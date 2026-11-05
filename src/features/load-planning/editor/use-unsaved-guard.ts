"use client";

import { useEffect } from "react";

/** Còn thay đổi chưa lưu thì trình duyệt hỏi trước khi đóng / tải lại trang. */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
