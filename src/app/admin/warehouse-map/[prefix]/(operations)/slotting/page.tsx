import { Suspense } from "react";

import { SlottingView } from "@/features/putaway";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/**
 * Gợi ý vị trí của một kho (docs 06 §4.4) — trang chỉ ghép: layout `[prefix]` lo kho, `(operations)` lo kho được gán,
 * `SlottingView` (feature cất hàng) hiện bin gợi ý của thùng chờ cất.
 */
export default function SlottingPage() {
  return (
    <div className="surface-soft surface-compact">
      <Suspense fallback={<PageSkeleton variant="detail" />}>
        <SlottingView />
      </Suspense>
    </div>
  );
}
