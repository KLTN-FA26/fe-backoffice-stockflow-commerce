import { Suspense } from "react";

import { PutawayList } from "@/features/putaway";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Cất hàng (docs 05 §4.2) của kho trong tab — layout `[prefix]` cấp kho, `(operations)` chặn kho không được gán. */
export default function WorkspacePutawayPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PutawayList />
    </Suspense>
  );
}
