import { Suspense } from "react";

import { CartonList } from "@/features/inventory";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Thùng hàng (LPN) — tra cứu mọi thùng (docs 20 §4.1). Trang chỉ ghép; quyền do `CartonList` kiểm. */
export default function CartonsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CartonList />
    </Suspense>
  );
}
