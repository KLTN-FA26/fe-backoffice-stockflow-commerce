"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
  DESIGN_ROUND_LABELS,
} from "@/constants";

import { useServerList } from "@/hooks/use-server-list";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useReviewRounds } from "@/features/design-review/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { REVIEW_ROUNDS_COPY } from "./copy";
import { ReviewQueueTabs } from "./ReviewQueueList";
import { reviewRoundColumns } from "./review-round-columns";

const NO_STATUSES: readonly never[] = [];

function ReviewRoundListContent() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const list = useServerList(DESIGN_REVIEW_STORAGE_KEYS.roundsConfig, NO_STATUSES);
  const query = useReviewRounds({ page: list.apiPage, size: list.pageSize });
  const columns = useMemo(() => reviewRoundColumns(now), [now]);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{DESIGN_ROUND_LABELS.listTitle}</h1>
      <ReviewQueueTabs value="project" />
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.designReviewRounds.detail(row.id))}
        noun="vòng duyệt"
        errorCopy={REVIEW_ROUNDS_COPY}
        hasFilters={false}
        onClearFilters={() => list.goToPage(0)}
        empty={{
          icon: <ClipboardCheck className="size-8" />,
          title: DESIGN_ROUND_LABELS.emptyTitle,
          description: DESIGN_ROUND_LABELS.emptyDescription,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/** Vòng duyệt chỉ cho người có `design-designs:APPROVE` (BE `DesignReviewRoundController`). */
export function ReviewRoundList() {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.approve]} variant="list">
      <ReviewRoundListContent />
    </PermissionBoundary>
  );
}
