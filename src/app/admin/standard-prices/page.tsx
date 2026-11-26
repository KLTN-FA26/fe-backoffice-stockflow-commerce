import { Suspense } from "react";

import { StandardPriceList } from "@/features/standard-price";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Giá chuẩn theo quy cách — BE `StandardPriceController`; quyền VIEW_PAGE do `StandardPriceList` kiểm. */
export default function StandardPricesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <StandardPriceList />
    </Suspense>
  );
}
