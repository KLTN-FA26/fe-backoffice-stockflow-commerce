"use client";

import { useEffect } from "react";

/**
 * Cảnh báo trình duyệt khi đóng tab / tải lại trang lúc form còn thay đổi chưa lưu.
 * (Điều hướng nội bộ bằng nút "Huỷ" của form tự hỏi lại bằng ConfirmDialog.)
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
