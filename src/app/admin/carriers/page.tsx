import { Suspense } from "react";

import { CarrierList } from "@/features/shipping/components/CarrierList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function CarriersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CarrierList />
    </Suspense>
  );
}
