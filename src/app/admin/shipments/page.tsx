import { Suspense } from "react";

import { LoadList } from "@/features/shipping/components/LoadList";
import { ShippingGate } from "@/features/shipping/components/ShippingGate";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ShipmentsPage() {
  return (
    <ShippingGate>
      <Suspense fallback={<PageSkeleton variant="list" />}>
        <LoadList />
      </Suspense>
    </ShippingGate>
  );
}
