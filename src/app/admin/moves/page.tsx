import { Suspense } from "react";

import { MOVE_LABELS } from "@/constants/move";

import { MoveCreate } from "@/features/move";
import { RecentMoves } from "@/features/inventory";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function MovesPage() {
  return (
    // Giao diện kiểu Vercel như form sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển thị —
    // breadcrumb là tên trang; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact space-y-[var(--card-pad)]">
      <h1 className="sr-only">{MOVE_LABELS.title}</h1>
      <Suspense fallback={<PageSkeleton variant="form" />}>
        <MoveCreate />
        <RecentMoves />
      </Suspense>
    </div>
  );
}
