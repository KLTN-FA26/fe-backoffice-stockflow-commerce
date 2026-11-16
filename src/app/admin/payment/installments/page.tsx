import { Suspense } from "react";

import { InstallmentList } from "@/features/payment";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Danh sách đợt thanh toán (docs 15 §5.1) — quyền VIEW_PAGE do `InstallmentList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <InstallmentList />
    </Suspense>
  );
}
