import { Suspense } from "react";

import { CustomerPriceList } from "@/features/customer-price";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Bảng giá khách hàng — BE `CustomerPriceController`; quyền VIEW_PAGE do `CustomerPriceList` kiểm. */
export default function CustomerPricesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CustomerPriceList />
    </Suspense>
  );
}
