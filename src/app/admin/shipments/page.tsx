import { Suspense } from "react";

import { ShipmentList } from "@/features/shipping/components/ShipmentList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ShipmentList />
    </Suspense>
  );
}
