import { Suspense } from "react";

import { MOVE_LABELS } from "@/constants/move";

import { MoveCreate } from "@/features/move";
import { RecentMoves } from "@/features/inventory";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function MovesPage() {
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader title={MOVE_LABELS.title} subtitle={MOVE_LABELS.subtitle} />
      <Suspense fallback={<PageSkeleton variant="form" />}>
        <MoveCreate />
        <RecentMoves />
      </Suspense>
    </div>
  );
}
