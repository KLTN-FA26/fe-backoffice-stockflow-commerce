import { Suspense } from "react";

import { MovementHistory } from "@/features/inventory";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <MovementHistory />
    </Suspense>
  );
}
