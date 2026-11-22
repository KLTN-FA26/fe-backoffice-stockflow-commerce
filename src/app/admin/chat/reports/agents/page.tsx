import { Suspense } from "react";

import { AgentsReportScreen } from "@/features/chat";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ChatAgentsReportPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <AgentsReportScreen />
    </Suspense>
  );
}
