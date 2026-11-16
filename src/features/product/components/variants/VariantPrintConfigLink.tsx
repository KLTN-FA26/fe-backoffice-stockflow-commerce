"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants";

import type { MouseEvent } from "react";

/**
 * Link của panel biến thể tới trang cấu hình in (module 12) — chỉ sản phẩm tuỳ chỉnh. Là component riêng để
 * `ref` / `onClick` của lối rời panel (`usePurchasingCloseGuard`) đi vào đây thay vì gắn thẳng ở `VariantPanel`.
 */
export function VariantPrintConfigLink({
  href,
  onClick,
  anchorRef,
}: {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  anchorRef: (node: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      href={href}
      ref={anchorRef}
      onClick={onClick}
      className="text-accent focus-visible:ring-brand/30 inline-flex items-center gap-1.5 rounded-[var(--r-sm)] text-sm font-semibold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {UI_LABELS.product.variants.printConfigLink}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
