import { Suspense } from "react";

import { SlottingView } from "@/features/putaway";
import { WarehouseScope } from "@/features/warehouse-map/components/workspace/WarehouseScope";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/**
 * Gợi ý vị trí của một kho (docs 06 §4.4) — trang chỉ ghép: `WarehouseScope` lo prefix / quyền đọc kho, `SlottingView`
 * (feature cất hàng) hiện bin gợi ý của thùng chờ cất.
 */
export default async function SlottingPage({ params }: { params: Promise<{ prefix: string }> }) {
  const prefix = decodeURIComponent((await params).prefix);
  return (
    <div className="surface-soft surface-compact">
      <WarehouseScope prefix={prefix}>
        <Suspense fallback={<PageSkeleton variant="detail" />}>
          <SlottingView prefix={prefix} />
        </Suspense>
      </WarehouseScope>
    </div>
  );
}
