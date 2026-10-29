import { AuthGuard } from "@/lib/auth/components/AuthGuard";
import { BackOfficeGuard } from "@/lib/auth/components/BackOfficeGuard";
import { PasswordChangeGuard } from "@/lib/auth/components/PasswordChangeGuard";
import { RoleSwitcher } from "@/lib/auth/components/RoleSwitcher";

import { BackofficeShell } from "@/components/backoffice/BackofficeShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Phiên (AuthGuard) → mật khẩu tạm phải đổi trước (PasswordChangeGuard, SCRUM-474) → nhân viên
    // back-office (BackOfficeGuard) → quyền từng trang (trong page)
    <AuthGuard>
      <PasswordChangeGuard>
        <BackOfficeGuard>
          <BackofficeShell>
            {children}
            <RoleSwitcher />
          </BackofficeShell>
        </BackOfficeGuard>
      </PasswordChangeGuard>
    </AuthGuard>
  );
}
