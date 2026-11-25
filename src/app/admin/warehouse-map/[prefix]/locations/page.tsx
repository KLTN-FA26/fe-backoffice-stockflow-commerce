import { Suspense } from "react";

import { LocationList } from "@/features/warehouse-map/components/locations/LocationList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/**
 * Danh sách vị trí của một kho (docs 06; docs 20 §4.1) — trang chỉ ghép: layout `[prefix]` lo kho. Nằm ngoài
 * `(operations)` như bản đồ: mã và cấu trúc vị trí xem được ở mọi kho, phần hàng tự ẩn ở kho không được gán.
 */
export default function WarehouseLocationsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <LocationList />
    </Suspense>
  );
}
