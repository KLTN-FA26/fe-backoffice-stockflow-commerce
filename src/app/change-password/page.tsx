import { ChangePasswordPage } from "@/lib/auth/components/ChangePasswordPage";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default function Page() {
  return <ChangePasswordPage />;
}
