import { Suspense } from "react";

import { ReturnReceiptList } from "@/features/return";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Phiếu nhập hàng hoàn (docs 03 §4.2) — quyền VIEW_PAGE do `ReturnReceiptList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReturnReceiptList />
    </Suspense>
  );
}
