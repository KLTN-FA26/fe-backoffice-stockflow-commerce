"use client";

import { useEffect, useRef } from "react";

import { Notice } from "./Notice";

import type { ReactNode } from "react";

/**
 * Lỗi chung của form sau khi gửi (BO-UX-17): đọc ngay cho screen reader (`live`), cuộn vào giữa màn hình và nhận
 * focus — người đang ở thanh nút dưới cùng của một form dài vẫn thấy có chuyện. Mỗi lần lỗi mới xuất hiện (từ không
 * có sang có) thì cuộn / focus lại; caller xoá lỗi trước mỗi lần gửi.
 */
export function FormErrorNotice({
  message,
  children,
  className,
}: {
  message: string | null | undefined;
  /** Phần thêm sau câu lỗi (vd nút "Tải lại"). */
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!message || !el) return;
    el.scrollIntoView?.({ block: "center" });
    el.focus({ preventScroll: true });
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} tabIndex={-1} className={className}>
      <Notice tone="danger" live>
        {message}
        {children}
      </Notice>
    </div>
  );
}
