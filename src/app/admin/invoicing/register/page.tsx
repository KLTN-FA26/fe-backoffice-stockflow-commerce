import { Suspense } from "react";

import { EInvoiceRegister } from "@/features/einvoice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Bảng kê hoá đơn theo kỳ (docs 21) — quyền do `EInvoiceRegister` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <EInvoiceRegister />
    </Suspense>
  );
}
