"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FolderKanban, Shapes } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_PERMISSIONS,
  DESIGN_REVIEW_LABELS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { useServerList } from "@/hooks/use-server-list";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useReviewQueue } from "@/features/design-review/queries";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { PageTabs } from "@/components/shared/PageTabs";

import { REVIEW_QUEUE_COPY } from "./copy";
import { reviewQueueColumns } from "./review-queue-columns";

import type { PageTabItem } from "@/components/shared/PageTabs";

type QueueTab = "single" | "project";

const NO_STATUSES: readonly never[] = [];

/** Hàng đợi đơn lẻ không gồm thiết kế còn nằm trong vòng duyệt dự án (BE `DesignDraftJpaRepository.java:40-52`). */
const TABS: readonly PageTabItem<QueueTab>[] = [
  { value: "single", label: DESIGN_REVIEW_LABELS.tabSingle, icon: Shapes },
  { value: "project", label: DESIGN_REVIEW_LABELS.tabProject, icon: FolderKanban },
];

/** Tab dùng chung với trang vòng duyệt (BO-4): đổi tab là đổi trang. */
export function ReviewQueueTabs({ value }: { value: QueueTab }) {
  const router = useRouter();
  return (
    <PageTabs
      tabs={TABS}
      value={value}
      idPrefix="design-review"
      ariaLabel="Loại hàng đợi duyệt"
      onChange={(next) =>
        router.push(
          next === "project"
            ? ADMIN_ROUTES.designReviewRounds.list
            : ADMIN_ROUTES.designs.reviewQueue,
        )
      }
    />
  );
}

function ReviewQueueContent() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const list = useServerList(DESIGN_REVIEW_STORAGE_KEYS.queueConfig, NO_STATUSES);
  const query = useReviewQueue({ page: list.apiPage, size: list.pageSize });
  const refetch = query.refetch;
  const columns = useMemo(() => reviewQueueColumns(now, () => void refetch()), [now, refetch]);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{DESIGN_REVIEW_LABELS.queueTitle}</h1>
      <ReviewQueueTabs value="single" />
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.designs.detail(row.id))}
        noun="thiết kế"
        errorCopy={REVIEW_QUEUE_COPY}
        hasFilters={false}
        onClearFilters={() => list.goToPage(0)}
        empty={{
          icon: <ClipboardCheck className="size-8" />,
          title: DESIGN_REVIEW_LABELS.queueEmptyTitle,
          description: DESIGN_REVIEW_LABELS.queueEmptyDescription,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/** Hàng đợi chỉ cho người có `design-designs:APPROVE` (SALES_STAFF có VIEW_PAGE nhưng BE trả 403). */
export function ReviewQueueList() {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.approve]} variant="list">
      <ReviewQueueContent />
    </PermissionBoundary>
  );
}
