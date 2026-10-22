import { Suspense } from "react";

import { SampleList } from "@/features/sample-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function SampleRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SampleList />
    </Suspense>
  );
}
