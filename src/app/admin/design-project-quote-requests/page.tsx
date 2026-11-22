import { Suspense } from "react";

import { ProjectQuoteRequestList } from "@/features/design-quote-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function DesignProjectQuoteRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProjectQuoteRequestList />
    </Suspense>
  );
}
