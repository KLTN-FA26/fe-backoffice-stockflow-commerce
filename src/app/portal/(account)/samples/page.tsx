import { Suspense } from "react";

import { PortalSampleList } from "@/features/sample-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PortalSamplesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PortalSampleList />
    </Suspense>
  );
}
