import { Suspense } from "react";

import { ReceivablesList } from "@/features/payment";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Công nợ phải thu theo khách (BO-UX-37, BE R5-11) — quyền VIEW_PAGE do `ReceivablesList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReceivablesList />
    </Suspense>
  );
}
