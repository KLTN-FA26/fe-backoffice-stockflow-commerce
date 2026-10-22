import { Suspense } from "react";

import { QuoteCreate } from "@/features/quote";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function QuoteCreatePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <QuoteCreate />
    </Suspense>
  );
}
