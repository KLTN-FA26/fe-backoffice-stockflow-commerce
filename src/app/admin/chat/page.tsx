import { Suspense } from "react";

import { ChatInbox } from "@/features/chat";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ChatPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ChatInbox />
    </Suspense>
  );
}
