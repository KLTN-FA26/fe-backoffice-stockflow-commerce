import { Suspense } from "react";

import { RefundList } from "@/features/payment";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Hoàn tiền (docs 15 §4.5) — quyền VIEW_PAGE do `RefundList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <RefundList />
    </Suspense>
  );
}
