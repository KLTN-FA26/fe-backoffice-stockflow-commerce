import { Suspense } from "react";

import { ContractList } from "@/features/order/components/contract/ContractList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ContractsRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ContractList />
    </Suspense>
  );
}
