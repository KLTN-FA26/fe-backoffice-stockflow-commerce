import { cn } from "cn";

import type { ReactNode } from "react";

/** Trình duyệt bỏ nền khi in; ô màu ký hiệu mặt hàng phải ép in đúng màu để khớp ảnh 3D. */
export const PRINT_EXACT = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
export const EMPTY = "—";
export const TH = "px-2 py-1.5 font-medium whitespace-nowrap";
export const TD = "px-2 py-1";
export const TABLE_FRAME = "border-border-default overflow-hidden rounded-[var(--r-sm)] border";
export const SECTION_TITLE = "text-ink-primary text-sm font-semibold";

/** Chữ ký hiệu mặt hàng trên nền đúng màu của hộp trong ảnh 3D. */
export function LetterChip({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-[var(--r-sm)] px-1 text-xs font-semibold text-black",
        PRINT_EXACT,
      )}
      style={{ backgroundColor: color }}
    >
      {letter}
    </span>
  );
}

/** Một ô "nhãn: giá trị" của đầu phiếu. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary text-[0.8125rem] font-medium break-words">{children}</dd>
    </div>
  );
}

/** Ảnh chụp 3D (data URL JPEG do `capture.ts` dựng) — không qua next/image vì không có URL để tối ưu. */
export function CapturedImage({
  src,
  alt,
  caption,
  maxHeightClass = "max-h-[100mm]",
}: {
  src: string;
  alt: string;
  caption?: string;
  /** Giới hạn chiều cao khi in để bảng kiện của bước còn chỗ trên cùng trang A4. */
  maxHeightClass?: string;
}) {
  return (
    <figure className="break-inside-avoid space-y-1">
      {caption && (
        <figcaption className="text-ink-secondary text-xs font-medium">{caption}</figcaption>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={cn("mx-auto w-full object-contain", maxHeightClass)} />
    </figure>
  );
}
