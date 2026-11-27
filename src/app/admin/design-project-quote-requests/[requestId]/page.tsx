import { Suspense } from "react";

import { ProjectQuoteRequestDetail } from "@/features/design-quote-request";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default async function ProjectQuoteRequestDetailPage({
  params,
}: PageProps<"/admin/design-project-quote-requests/[requestId]">) {
  const { requestId } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <ProjectQuoteRequestDetail requestId={requestId} />
    </Suspense>
  );
}
