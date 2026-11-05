import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";

/** Cùng kiểu nút quay lại của form PO / NCC: link viền, radius sm (Mode A). */
export function ProductFormBackLink() {
  return (
    <Link
      href={ADMIN_ROUTES.products.list}
      className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
    >
      <ArrowLeft className="size-3.5" />
      Quay lại danh sách
    </Link>
  );
}

export function ProductFormForbidden({ isEditing }: { isEditing: boolean }) {
  return (
    <EmptyState
      title="Bạn không có quyền"
      description={`Tài khoản hiện tại không có quyền ${isEditing ? "chỉnh sửa" : "tạo"} sản phẩm.`}
      action={<ProductFormBackLink />}
    />
  );
}
