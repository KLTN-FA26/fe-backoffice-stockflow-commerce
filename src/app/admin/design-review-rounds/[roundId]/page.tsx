import { Suspense } from "react";

import { ReviewRoundDetail } from "@/features/design-review";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default async function ReviewRoundDetailPage({
  params,
}: PageProps<"/admin/design-review-rounds/[roundId]">) {
  const { roundId } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <ReviewRoundDetail roundId={roundId} />
    </Suspense>
  );
}
