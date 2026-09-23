import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "cn";

import { ADMIN_ROUTES } from "@/constants";

export function OpenPoSection({
  openPoCount,
  isActive,
}: {
  openPoCount: number;
  isActive: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--card-radius)] border p-[var(--card-pad)]",
        openPoCount > 0 ? "border-warning/30 bg-warning/5" : "border-border-default bg-bg-surface",
      )}
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <ShoppingCart className={cn("size-4", openPoCount > 0 ? "text-warning" : "text-accent")} />
        Đơn đặt hàng đang mở
      </h2>
      {openPoCount > 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">
          Nhà cung cấp này có <span className="text-warning font-semibold">{openPoCount}</span> đơn
          đặt hàng chưa đóng.
          {isActive && " Nếu vô hiệu hoá, backend có thể cảnh báo hoặc chặn (SCRUM-118)."}
        </p>
      ) : (
        <p className="text-ink-secondary text-[0.8125rem]">
          Không có đơn đặt hàng nào đang mở. Có thể vô hiệu hoá an toàn.
        </p>
      )}
      <Link
        href={ADMIN_ROUTES.purchaseOrders.list}
        className="text-accent mt-3 inline-flex text-[0.8125rem] font-medium hover:underline"
      >
        Xem danh sách PO →
      </Link>
    </section>
  );
}
