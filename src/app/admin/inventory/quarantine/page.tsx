import { Suspense } from "react";

import { QuarantineDecision } from "@/features/inventory";
import { CustomerCustodyCartons } from "@/features/return";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <QuarantineDecision />
      {/* WF-05 Q-4 / TH-6 (audit r2 returns H1): thùng giữ hộ khách ở khu cách ly — Quản lý kho thực hiện lựa chọn của khách */}
      <div className="surface-soft surface-compact mt-[var(--card-pad)]">
        <CustomerCustodyCartons title="Hàng giữ hộ khách (yêu cầu trả hàng không hoàn tiền)" />
      </div>
    </Suspense>
  );
}
