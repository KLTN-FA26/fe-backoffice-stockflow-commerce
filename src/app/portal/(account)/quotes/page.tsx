import { Suspense } from "react";

import { PortalQuoteList } from "@/features/quote";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PortalQuotesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PortalQuoteList />
    </Suspense>
  );
}
