import { Suspense } from "react";

import { ReceivingList } from "@/features/receipt/components/workspace/ReceivingList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Nhận hàng (docs 03) của kho trong tab — layout `[prefix]` cấp kho, `(operations)` chặn kho không được gán. */
export default function WorkspaceReceivingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReceivingList />
    </Suspense>
  );
}
