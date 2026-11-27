import Link from "next/link";

import { ADMIN_ROUTES, APP_ROUTES, PORTAL_ROUTES, UI_LABELS } from "@/constants";

import { Logo } from "@/components/shared/Logo";
import { NotFoundView } from "@/components/shared/NotFoundView";

const L = UI_LABELS.notFound;

/**
 * Trang 404 chung (đường dẫn không tồn tại ngoài `/admin`): tiếng Việt, có logo về trang chủ và các lối đi tiếp cho cả
 * nhân viên (trang quản trị) lẫn khách (đơn hàng của tôi) — mỗi lối tự kiểm phiên / vai trò khi mở.
 */
export default function NotFound() {
  return (
    <NotFoundView
      fullPage
      header={
        <header className="border-border-default bg-bg-surface border-b px-5 py-3">
          <Link href={APP_ROUTES.home} aria-label={L.home} className="inline-flex">
            <Logo height={28} />
          </Link>
        </header>
      }
      actions={[
        { href: APP_ROUTES.home, label: L.home },
        { href: ADMIN_ROUTES.home, label: L.admin },
        { href: PORTAL_ROUTES.orders.list, label: L.myOrders },
      ]}
    />
  );
}
