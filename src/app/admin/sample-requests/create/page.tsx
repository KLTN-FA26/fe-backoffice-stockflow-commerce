import { Suspense } from "react";

import { SampleCreate } from "@/features/sample-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function SampleCreatePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <SampleCreate />
    </Suspense>
  );
}
