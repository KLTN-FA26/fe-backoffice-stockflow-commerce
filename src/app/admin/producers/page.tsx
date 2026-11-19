import { Suspense } from "react";

import { ProducerList } from "@/features/producer/components/ProducerList";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ProducersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProducerList />
    </Suspense>
  );
}
