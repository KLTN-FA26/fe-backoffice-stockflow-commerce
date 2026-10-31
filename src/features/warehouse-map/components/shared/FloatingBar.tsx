"use client";

import { cn } from "cn";

import type { ReactNode } from "react";

/**
 * Thanh công cụ nổi trên bản đồ (không chiếm chỗ của canvas): nền `bg.surface`, viền, bóng `--sh-md`,
 * bo 8px. Đặt `absolute` trong khung bản đồ `relative`, lớp `--z-sticky` — dưới dropdown / dialog.
 */
export function FloatingBar({
  label,
  orientation = "horizontal",
  inline = false,
  className,
  children,
}: {
  label: string;
  orientation?: "horizontal" | "vertical";
  /** Nằm trong luồng trang (hàng trên bản đồ) thay vì nổi trên bản đồ. */
  inline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        "border-border-default bg-bg-surface flex gap-1 rounded-(--card-radius) border p-1",
        inline ? "w-fit shadow-(--control-shadow)" : "absolute z-(--z-sticky) shadow-(--sh-md)",
        orientation === "vertical" && "flex-col",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vạch ngăn nhóm nút trong thanh nổi. */
export function FloatingDivider({ vertical = false }: { vertical?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("bg-border-default self-stretch", vertical ? "mx-1 h-px w-auto" : "my-1 w-px")}
    />
  );
}
