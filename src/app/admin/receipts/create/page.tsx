import { Suspense } from "react";

import { ReceiptCreate } from "@/features/receipt/components/ReceiptCreate";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ReceiptCreatePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <ReceiptCreate />
    </Suspense>
  );
}
