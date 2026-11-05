"use client";

import { useState } from "react";
import { FileText, ImageOff } from "lucide-react";

import { safeHttpUrl } from "@/lib/api/signed-url";
import { Button } from "@/components/ui/button";

const FRAME =
  "border-border-default bg-bg-subtle flex items-center justify-center overflow-hidden rounded-[var(--r-sm)] border";
const SIZE = { full: "h-72 w-full", thumb: "size-32 shrink-0" } as const;

/**
 * Xem trước file qua link ký ngắn hạn của BE (không qua next/image — domain đổi theo kho lưu trữ).
 * Ảnh → `<img>`; PDF → trình xem PDF của trình duyệt (chỉ khổ `full`); định dạng khác → báo tải về.
 * Link hết hạn / tải lỗi → nút lấy link mới (`onRefresh` gọi lại API cấp link).
 */
export function SignedFilePreview({
  url,
  contentType,
  alt,
  size = "full",
  onRefresh,
}: {
  url: string;
  contentType: string;
  alt: string;
  size?: keyof typeof SIZE;
  onRefresh: () => void;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const safe = safeHttpUrl(url);
  const frame = `${FRAME} ${SIZE[size]}`;
  const message = (text: string, retry: boolean) => (
    <div className={`${frame} text-ink-tertiary flex-col gap-1.5 p-3 text-center text-xs`}>
      <ImageOff className="size-5" aria-hidden />
      {text}
      {retry && (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0"
          onClick={() => {
            setBrokenUrl(null);
            onRefresh();
          }}
        >
          Lấy link mới
        </Button>
      )}
    </div>
  );

  if (!safe) return message("Link file không hợp lệ — không mở.", false);
  if (brokenUrl === safe)
    return message("Không tải được bản xem trước (link có thể đã hết hạn).", true);
  if (contentType.startsWith("image/"))
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safe}
          alt={alt}
          className="size-full object-contain"
          onError={() => setBrokenUrl(safe)}
        />
      </div>
    );
  if (contentType === "application/pdf" && size === "full")
    return (
      <object data={safe} type="application/pdf" aria-label={alt} className={frame}>
        <div className="text-ink-tertiary flex flex-col items-center gap-1.5 p-3 text-center text-xs">
          <FileText className="size-5" aria-hidden />
          Trình duyệt không hiển thị PDF tại chỗ — dùng nút mở file.
        </div>
      </object>
    );
  return (
    <div className={`${frame} text-ink-tertiary flex-col gap-1.5 p-3 text-center text-xs`}>
      <FileText className="size-5" aria-hidden />
      {contentType === "application/pdf" ? "File PDF" : contentType}
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
      >
        Mở file để xem
      </a>
    </div>
  );
}
