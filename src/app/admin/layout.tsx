import { AreaGate } from "@/lib/auth/components/AreaGate";
import { AuthGuard } from "@/lib/auth/components/AuthGuard";
import { BackOfficeGuard } from "@/lib/auth/components/BackOfficeGuard";
import { RoleSwitcher } from "@/lib/auth/components/RoleSwitcher";

import { BackofficeShell } from "@/components/backoffice/BackofficeShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Phiên (AuthGuard) → khách portal về /portal (AreaGate) → nhân viên back-office (BackOfficeGuard)
    // → quyền từng trang (trong page)
    <AuthGuard>
      <AreaGate area="admin">
        <BackOfficeGuard>
          <BackofficeShell>
            {children}
            <RoleSwitcher />
          </BackofficeShell>
        </BackOfficeGuard>
      </AreaGate>
    </AuthGuard>
  );
}
