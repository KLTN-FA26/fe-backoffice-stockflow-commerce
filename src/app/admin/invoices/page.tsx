import { Suspense } from "react";

import { InvoiceList } from "@/features/invoice/components/InvoiceList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <InvoiceList />
    </Suspense>
  );
}
