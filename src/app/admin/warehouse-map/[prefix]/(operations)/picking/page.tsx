import { Suspense } from "react";

import { PickingList } from "@/features/fulfillment/components/TaskList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Lấy hàng (docs 07) của kho trong tab — layout `[prefix]` cấp kho, `(operations)` chặn kho không được gán. */
export default function WorkspacePickingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PickingList />
    </Suspense>
  );
}
