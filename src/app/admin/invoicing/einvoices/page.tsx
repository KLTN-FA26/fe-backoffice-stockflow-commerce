import { Suspense } from "react";

import { EInvoiceList } from "@/features/einvoice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Danh sách hoá đơn điện tử (docs 21) — quyền VIEW_PAGE do `EInvoiceList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <EInvoiceList />
    </Suspense>
  );
}
