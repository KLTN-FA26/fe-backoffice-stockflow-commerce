import { Suspense } from "react";

import { PackingQueue } from "@/features/fulfillment/components/PackingQueue";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PackingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PackingQueue />
    </Suspense>
  );
}
