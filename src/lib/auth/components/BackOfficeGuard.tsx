"use client";

import { useRouter } from "next/navigation";

import { APP_ROUTES } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";

import { ApiError } from "@/lib/api/error";
import { logoutApi } from "@/lib/auth/auth-api";
import { isBackOfficeActor } from "@/lib/auth/back-office";
import { useMyPermissions } from "@/lib/auth/me-permissions";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

/**
 * Cổng chung của `/admin/**`: chỉ nhân viên back-office (BE `ScopeGuards#requireBackOffice`) —
 * đứng SAU `AuthGuard` (phiên) và TRƯỚC cổng quyền từng trang (`OrderPermissionGate`,
 * `PermissionBoundary`…), không thay chúng. Không redirect (tránh vòng lặp /admin ↔ /login khi
 * phiên còn hiệu lực): hiện màn từ chối tại chỗ + đăng xuất. UI-only — BE vẫn tự chặn.
 */
export function BackOfficeGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const query = useMyPermissions();

  // Đang tải vai trò → khung chờ, không hiện shell / nội dung (không nháy rồi mất)
  if (query.isPending) {
    return (
      <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
        <PageSkeleton />
      </main>
    );
  }
  if (query.isError && !(query.error instanceof ApiError && query.error.status === 403)) {
    return (
      <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
        <section role="alert" className="space-y-4">
          <h1 className="text-ink-primary font-semibold">{PERMISSION_UI.errorTitle}</h1>
          <Button onClick={() => void query.refetch()}>{PERMISSION_UI.retry}</Button>
        </section>
      </main>
    );
  }
  if (!isBackOfficeActor(query.data)) {
    const logout = async () => {
      try {
        await logoutApi();
      } finally {
        router.replace(APP_ROUTES.login);
      }
    };
    return (
      <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
        <section role="alert" className="space-y-4">
          <h1 className="text-ink-primary font-semibold">{PERMISSION_UI.backOfficeDeniedTitle}</h1>
          <p className="text-ink-secondary">{PERMISSION_UI.backOfficeDeniedDescription}</p>
          <Button variant="outline" onClick={() => void logout()}>
            {PERMISSION_UI.logout}
          </Button>
        </section>
      </main>
    );
  }
  return children;
}
