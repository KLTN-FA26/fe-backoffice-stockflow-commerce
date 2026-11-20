import { Suspense } from "react";

import { CannedResponsesScreen } from "@/features/chat";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function CannedResponsesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CannedResponsesScreen />
    </Suspense>
  );
}
