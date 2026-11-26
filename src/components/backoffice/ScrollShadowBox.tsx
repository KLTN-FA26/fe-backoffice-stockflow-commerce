import { cn } from "cn";

import type { ReactNode } from "react";

/**
 * Khung cuộn ngang cho bảng rộng hơn khung chứa: bóng mờ ở mép còn nội dung phía sau (và mất khi đã cuộn tới mép) báo
 * "còn cột bên kia" — không cắt cột lặng lẽ. Chỉ CSS (background-attachment: local), không cần đo kích thước.
 */
const SHADOW_STYLE = {
  backgroundImage: [
    "linear-gradient(to right, var(--bg-surface), var(--bg-surface))",
    "linear-gradient(to left, var(--bg-surface), var(--bg-surface))",
    "linear-gradient(to right, color-mix(in srgb, var(--ink-primary) 16%, transparent), transparent)",
    "linear-gradient(to left, color-mix(in srgb, var(--ink-primary) 16%, transparent), transparent)",
  ].join(", "),
  backgroundPosition: "left center, right center, left center, right center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "24px 100%, 24px 100%, 12px 100%, 12px 100%",
  backgroundAttachment: "local, local, scroll, scroll",
} as const;

export function ScrollShadowBox({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={SHADOW_STYLE}
      className={cn(
        "border-border-default overflow-x-auto rounded-[var(--r-sm)] border",
        className,
      )}
    >
      {children}
    </div>
  );
}
