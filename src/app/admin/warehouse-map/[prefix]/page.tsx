import { Suspense } from "react";

import { WarehouseMapView } from "@/features/warehouse-map/components/map/WarehouseMapView";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Bản đồ kho 2D / 3D của kho có prefix trên URL (docs 06 §1, §4). */
export default async function WarehouseMapPage({
  params,
}: {
  params: Promise<{ prefix: string }>;
}) {
  const { prefix } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <WarehouseMapView prefix={decodeURIComponent(prefix)} />
    </Suspense>
  );
}
