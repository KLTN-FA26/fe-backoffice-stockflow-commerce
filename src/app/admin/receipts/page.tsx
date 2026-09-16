import { Suspense } from "react";

import { ReceiptList } from "@/features/receipt/components/ReceiptList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReceiptList />
    </Suspense>
  );
}
