import { Suspense } from "react";

import { ProductList } from "@/features/product/components/ProductList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProductList />
    </Suspense>
  );
}
