import { Suspense } from "react";

import { PutawayList } from "@/features/putaway";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PutawayPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PutawayList />
    </Suspense>
  );
}
