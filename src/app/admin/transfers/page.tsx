import { Suspense } from "react";

import { TransferList } from "@/features/transfer/components/TransferList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function TransfersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <TransferList />
    </Suspense>
  );
}
