import { Suspense } from "react";

import { QuarantineDecision } from "@/features/inventory";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <QuarantineDecision />
    </Suspense>
  );
}
