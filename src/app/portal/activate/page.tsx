import { PortalActivation } from "@/features/customer";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kích hoạt tài khoản portal" };

/** Công khai (proxy.ts bỏ qua) — khách chưa có mật khẩu nên chưa thể có phiên. */
export default function PortalActivatePage() {
  return <PortalActivation />;
}
