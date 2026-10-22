import { Suspense } from "react";

import { CustomerList } from "@/features/customer";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CustomerList />
    </Suspense>
  );
}
