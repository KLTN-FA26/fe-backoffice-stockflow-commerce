import { Suspense } from "react";

import { QuarantineDecision } from "@/features/inventory";
import { CustodyNotesList, CustomerCustodyCartons } from "@/features/return";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <QuarantineDecision />
      {/* WF-05 Q-4 / TH-6 (audit r2 returns H1): thùng giữ hộ khách ở khu cách ly — Quản lý kho thực hiện lựa chọn của khách */}
      <div className="surface-soft surface-compact mt-[var(--card-pad)]">
        <CustomerCustodyCartons title="Thùng giữ hộ khách (khoản hoàn tiền không lấy lại)" />
      </div>
      {/* Audit r3 RAD-3 (Q-11, TH-6): hàng giữ hộ trên biên nhận — Sale ghi lựa chọn, Quản lý kho ghi đã rời kho */}
      <div className="surface-soft surface-compact mt-[var(--card-pad)]">
        <CustodyNotesList />
      </div>
    </Suspense>
  );
}
