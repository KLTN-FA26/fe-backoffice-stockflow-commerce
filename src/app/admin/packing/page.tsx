import { Suspense } from "react";

import { CartonCheckQueue } from "@/features/fulfillment/components/CartonCheckQueue";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PackingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CartonCheckQueue />
    </Suspense>
  );
}
