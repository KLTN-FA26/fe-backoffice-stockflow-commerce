import { DotBackdrop } from "@/components/shared/DotBackdrop";

import type { ReactNode } from "react";

/**
 * Màn toàn trang ngoài shell (đang xác minh phiên, đang tải trang đăng nhập, lỗi khởi động):
 * nền chấm + đốm màu mờ (cùng style trang chủ / đăng nhập), nội dung đứng thẳng giữa trang —
 * không bọc khung để xe tải loader nổi trên nền.
 */
export function GlassScreen({ children }: { children: ReactNode }) {
  return (
    <main className="bg-bg-base relative isolate flex min-h-screen items-center justify-center px-6">
      <DotBackdrop glowClassName="size-[min(420px,80vw)]" />
      {children}
    </main>
  );
}
