import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { UI_LABELS } from "@/constants";

/**
 * Nút "Quay lại" ở PageHeader của trang chi tiết / tạo — một kiểu duy nhất (viền trung tính, nền
 * surface, như trang chi tiết NCC). `label` chỉ đổi khi quay về một bước khác danh sách.
 */
export function BackLink({
  href,
  label = UI_LABELS.common.back,
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
    >
      <ArrowLeft className="size-3.5" /> {label}
    </Link>
  );
}
