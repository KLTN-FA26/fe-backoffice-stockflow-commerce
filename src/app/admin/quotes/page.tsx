import { Suspense } from "react";

import { QuoteList } from "@/features/quote";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function QuotesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <QuoteList />
    </Suspense>
  );
}
