import { Suspense } from "react";

import { DesignReviewDetail } from "@/features/design-review";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default async function DesignReviewDetailPage({
  params,
}: PageProps<"/admin/designs/review-queue/[designId]">) {
  const { designId } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <DesignReviewDetail id={designId} />
    </Suspense>
  );
}
