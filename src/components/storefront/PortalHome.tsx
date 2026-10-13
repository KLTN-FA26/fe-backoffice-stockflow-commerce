"use client";

import Link from "next/link";
import { ArrowRight, FileText, FlaskConical, PackageOpen } from "lucide-react";

import {
  ORDER_PERMISSIONS,
  PORTAL_ROUTES,
  QUOTE_PERMISSIONS,
  SAMPLE_REQUEST_PERMISSIONS,
} from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useMyPermissions } from "@/lib/auth/me-permissions";
import { Skeleton } from "@/components/shared/Skeleton";

const ENTRIES = [
  {
    href: PORTAL_ROUTES.quotes.list,
    icon: FileText,
    title: "Báo giá",
    description: "Xem báo giá Sales gửi, chấp nhận hoặc yêu cầu chỉnh sửa.",
    permission: QUOTE_PERMISSIONS.read,
  },
  {
    href: PORTAL_ROUTES.orders.list,
    icon: PackageOpen,
    title: "Đơn hàng",
    description: "Theo dõi tiến trình đơn và đặt lại bằng yêu cầu báo giá mới.",
    permission: ORDER_PERMISSIONS.read,
  },
  {
    href: PORTAL_ROUTES.samples.list,
    icon: FlaskConical,
    title: "Mẫu thử",
    description: "Duyệt mẫu in trước khi sản xuất hàng loạt, hoặc gửi góp ý để làm lại.",
    permission: SAMPLE_REQUEST_PERMISSIONS.read,
  },
] as const;

/** Trang chủ portal — chỉ lối vào thật, không số liệu tổng hợp giả. */
export function PortalHome() {
  const user = useAuthStore((state) => state.user);
  const can = usePermissionChecker();
  const permissions = useMyPermissions();
  const entries = ENTRIES.filter((entry) => can(entry.permission));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold sm:text-3xl">
          Xin chào{user?.fullName ? `, ${user.fullName}` : ""}
        </h1>
        <p className="text-ink-secondary max-w-[68ch]">
          Theo dõi báo giá và mẫu in của doanh nghiệp bạn. Mọi thay đổi được ghi nhận cho bộ phận
          bán hàng.
        </p>
      </div>
      {permissions.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          <Skeleton className="h-24 rounded-[var(--r-lg)]" />
          <Skeleton className="h-24 rounded-[var(--r-lg)]" />
        </div>
      ) : permissions.isError ? (
        <p role="alert" className="text-danger">
          Không tải được quyền truy cập.{" "}
          <button type="button" className="underline" onClick={() => void permissions.refetch()}>
            Thử lại
          </button>
        </p>
      ) : entries.length === 0 ? (
        <p className="text-ink-secondary">Tài khoản chưa được cấp quyền xem báo giá hay mẫu thử.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="bg-bg-surface border-border-default focus-visible:ring-brand group flex min-h-11 items-start gap-4 rounded-[var(--r-lg)] border p-6 shadow-[var(--sh-md)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <Icon className="text-brand mt-0.5 size-6 shrink-0" aria-hidden="true" />
                  <span className="flex-1 space-y-1">
                    <span className="text-ink-primary block font-semibold">{entry.title}</span>
                    <span className="text-ink-secondary block text-sm">{entry.description}</span>
                  </span>
                  <ArrowRight className="text-ink-tertiary size-5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
