import { Suspense } from "react";

import { LoadList } from "@/features/shipping/components/LoadList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <LoadList />
    </Suspense>
  );
}
