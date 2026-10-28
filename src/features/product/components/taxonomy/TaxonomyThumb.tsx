"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

// Chỉ hiển thị URL http(s) tuyệt đối hoặc đường dẫn gốc — URL ảnh do người dùng nhập, BE không kiểm
const DISPLAYABLE_URL = /^(https?:\/\/|\/(?!\/))/i;

/**
 * Ảnh nhỏ (logo thương hiệu / ảnh danh mục) — URL do BE lưu nguyên văn, domain bất kỳ nên không qua
 * `next/image`. Không có URL hoặc ảnh lỗi → ô chữ cái đầu của tên.
 */
export function TaxonomyThumb({ url, name }: { url: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  const box = "border-border-default size-7 shrink-0 rounded-[var(--r-sm)] border";
  if (!url || failed || !DISPLAYABLE_URL.test(url)) {
    return (
      <span
        aria-hidden="true"
        className={`${box} bg-bg-muted text-ink-tertiary grid place-items-center text-[0.75rem] font-semibold`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className={`${box} bg-bg-surface object-contain`}
    />
  );
}

/**
 * Ảnh xem trước cho ô nhập URL — chỉ tải khi người dùng ngừng gõ 400ms, tránh mỗi phím gõ tạo một
 * request tới URL dở dang ("https://c", "https://cd", …) và ảnh nhấp nháy giữa lỗi / chữ cái.
 */
export function UrlPreviewThumb({ url, name }: { url: string; name: string }) {
  const settled = useDebouncedValue(url.trim(), 400);
  // key theo URL: đổi URL thì bỏ trạng thái "ảnh lỗi" của URL cũ
  return <TaxonomyThumb key={settled} url={settled} name={name || "?"} />;
}
