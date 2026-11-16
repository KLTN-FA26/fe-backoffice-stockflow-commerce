import { Suspense } from "react";

import { ReceiptList } from "@/features/payment";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Danh sách phiếu thu (docs 15 §5.3) — quyền VIEW_PAGE do `ReceiptList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReceiptList />
    </Suspense>
  );
}
