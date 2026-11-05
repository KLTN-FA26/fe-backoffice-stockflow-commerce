import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { VehicleTypeList } from "@/features/vehicle-type/components/VehicleTypeList";

export default function VehicleTypesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <VehicleTypeList />
    </Suspense>
  );
}
