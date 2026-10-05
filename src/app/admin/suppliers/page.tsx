import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SupplierList } from "@/features/supplier/components/SupplierList";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SupplierList />
    </Suspense>
  );
}
