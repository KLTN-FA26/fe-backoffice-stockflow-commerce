import { Suspense } from "react";

import { CreditRequestList } from "@/features/credit-request";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Đề nghị cấp hạn mức (15 §4.3) — quyền VIEW_PAGE do `CreditRequestList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CreditRequestList />
    </Suspense>
  );
}
