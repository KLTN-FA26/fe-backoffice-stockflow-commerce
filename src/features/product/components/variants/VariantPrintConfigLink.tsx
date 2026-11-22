"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants";

/** Link của panel biến thể tới trang cấu hình in (module 12) — chỉ sản phẩm tuỳ chỉnh. */
export function VariantPrintConfigLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-accent-text focus-visible:ring-brand/30 inline-flex items-center gap-1.5 rounded-[var(--r-sm)] text-sm font-semibold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {UI_LABELS.product.variants.printConfigLink}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
