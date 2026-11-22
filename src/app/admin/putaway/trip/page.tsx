import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { MyTripRoutePage } from "../_components/TripRoutePages";

export default function PutawayTripRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <MyTripRoutePage />
    </Suspense>
  );
}
