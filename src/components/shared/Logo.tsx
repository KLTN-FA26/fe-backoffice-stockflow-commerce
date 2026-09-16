import { cn } from "cn";
import Image from "next/image";

import { BRAND, BRAND_ASPECT } from "@/constants";

type LogoVariant = "full" | "mark";

interface LogoProps {
  /** `full` = wordmark + subtitle; `mark` = chỉ icon vuông. Mặc định `full`. */
  variant?: LogoVariant;
  /** Chiều cao render (px). Width tự suy ra theo tỉ lệ gốc để ảnh không méo. */
  height?: number;
  /**
   * Logo đứng một mình (link về trang chủ, header) → để trống, alt = tên thương hiệu.
   * Logo đứng cạnh text đã nêu tên rồi → truyền `decorative` để tránh screen reader
   * đọc trùng tên hai lần.
   */
  decorative?: boolean;
  className?: string;
}

export function Logo({ variant = "full", height = 32, decorative = false, className }: LogoProps) {
  const isFull = variant === "full";
  const src = isFull ? BRAND.logoSrc : BRAND.iconSrc;
  const ratio = isFull ? BRAND_ASPECT.full : BRAND_ASPECT.mark;

  return (
    <Image
      src={src}
      alt={decorative ? "" : BRAND.logoAlt}
      aria-hidden={decorative || undefined}
      width={Math.round(height * ratio)}
      height={height}
      priority
      className={cn("block w-auto shrink-0 select-none", className)}
      style={{ height }}
      draggable={false}
    />
  );
}
