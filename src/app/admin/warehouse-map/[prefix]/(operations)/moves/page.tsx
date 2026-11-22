import { Suspense } from "react";

import { MOVE_LABELS } from "@/constants/move";

import { MoveCreate } from "@/features/move";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { RecentMovesOfTab } from "./_components/RecentMovesOfTab";

/** Di chuyển nội bộ (docs 11) trong kho của tab — layout `[prefix]` cấp kho, `(operations)` chặn kho không được gán. */
export default function WorkspaceMovesPage() {
  return (
    // Giao diện kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị — breadcrumb là tên trang
    <div className="surface-soft surface-compact space-y-[var(--card-pad)]">
      <h1 className="sr-only">{MOVE_LABELS.title}</h1>
      <Suspense fallback={<PageSkeleton variant="form" />}>
        <MoveCreate />
        <RecentMovesOfTab />
      </Suspense>
    </div>
  );
}
