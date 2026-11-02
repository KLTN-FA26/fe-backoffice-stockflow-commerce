import { AreaGate } from "@/lib/auth/components/AreaGate";
import { AuthGuard } from "@/lib/auth/components/AuthGuard";

import { PortalShell } from "@/components/storefront/PortalShell";

/** Portal khách hàng B2B (Mode B) — cần phiên; nhân viên bị đưa về /admin. */
export default function PortalAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AreaGate area="portal">
        <PortalShell>{children}</PortalShell>
      </AreaGate>
    </AuthGuard>
  );
}
