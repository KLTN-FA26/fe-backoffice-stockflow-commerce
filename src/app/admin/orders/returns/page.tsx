import { Suspense } from "react";

import { ReturnList } from "@/features/return";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Yêu cầu trả hàng (docs 17 §4.10) — quyền VIEW_PAGE do `ReturnList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReturnList />
    </Suspense>
  );
}
