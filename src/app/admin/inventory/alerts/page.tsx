import { Suspense } from "react";

import { InventoryAlertList } from "@/features/inventory";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <InventoryAlertList />
    </Suspense>
  );
}
