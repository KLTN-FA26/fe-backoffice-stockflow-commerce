import { Suspense } from "react";

import { DesignQuoteRequestList } from "@/features/design-quote-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function DesignQuoteRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <DesignQuoteRequestList />
    </Suspense>
  );
}
