import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SupplierForm } from "@/features/supplier/components/SupplierForm";

export default function CreateSupplierPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SupplierForm />
    </Suspense>
  );
}
