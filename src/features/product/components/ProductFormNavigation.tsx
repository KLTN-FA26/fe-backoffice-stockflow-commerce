import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export function ProductFormBackLink() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={ADMIN_ROUTES.products.list}>
        <ArrowLeft className="size-4" />
        Quay lại danh sách
      </Link>
    </Button>
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
