import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

export function PurchaseOrdersSection({ supplierId }: { supplierId: string }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <ShoppingCart className="text-accent size-4" /> Đơn đặt hàng
      </h2>
      <p className="text-ink-secondary text-[0.8125rem]">
        Không thể ngừng hợp tác khi nhà cung cấp còn đơn đặt hàng đang mở (nháp, đã duyệt, đã gửi
        hoặc nhận một phần) — hệ thống sẽ báo lỗi khi thao tác.
      </p>
      <Link
        href={ADMIN_ROUTES.suppliers.purchaseOrders(supplierId)}
        className="text-accent mt-3 inline-flex text-[0.8125rem] font-medium hover:underline"
      >
        Xem đơn đặt hàng của nhà cung cấp này →
      </Link>
    </section>
  );
}
