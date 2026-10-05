import { Box } from "lucide-react";
import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export default function OrdersNotFound() {
  return (
    <EmptyState
      icon={<Box className="size-8" />}
      title="Không tìm thấy trang đơn hàng"
      description="Đường dẫn không tồn tại hoặc đã bị thay đổi."
      action={
        <Button asChild variant="outline" size="sm" className="rounded-[var(--r-sm)]">
          <Link href={ADMIN_ROUTES.orders.list}>Quay lại danh sách</Link>
        </Button>
      }
    />
  );
}
