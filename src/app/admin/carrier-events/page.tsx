import { Suspense } from "react";

import { CarrierEventList } from "@/features/shipping/components/CarrierEventList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function CarrierEventsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CarrierEventList />
    </Suspense>
  );
}
