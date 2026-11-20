"use client";

import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";

import {
  DESIGN_PERMISSIONS,
  DESIGN_REVIEW_LABELS,
  DESIGN_STATUS_LABELS,
  DESIGN_STATUS_TONE_KEY,
} from "@/constants";

import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { isUncertainOutcome } from "@/features/design-review/errors";
import { reviewReturnHref, useDecideDesign } from "@/features/design-review/mutations";
import { useDesign, useDesignArtifacts } from "@/features/design-review/queries";
import { currentSubmission } from "@/features/design-review/selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { DESIGN_DETAIL_COPY } from "./copy";
import { DesignGeneral } from "./detail/DesignGeneral";
import { DesignHistoryPanel } from "./detail/DesignHistoryPanel";
import { DesignPreview } from "./detail/DesignPreview";
import { PreflightPanel } from "./detail/PreflightPanel";
import { QuoteRequestsPanel } from "./detail/QuoteRequestsPanel";
import { ReviewActions } from "./detail/ReviewActions";
import { SubmittedFiles } from "./detail/SubmittedFiles";

import type { Design } from "@/features/design-review/types";

function FilesBlocks({ design }: { design: Design }) {
  const artifacts = useDesignArtifacts(design.id);
  const submission = currentSubmission(artifacts.data ?? []);
  return (
    <>
      <SubmittedFiles designId={design.id} submission={submission} />
      <PreflightPanel
        designId={design.id}
        printFile={submission.current.find((artifact) => artifact.role === "PRINT_READY")}
      />
    </>
  );
}

function DesignReviewDetailContent({ id }: { id: string }) {
  const canRead = useCan(DESIGN_PERMISSIONS.read);
  const [now] = useState(() => new Date());
  const [roundId] = useQueryState("round", parseAsString);
  const decide = useDecideDesign({ roundId });
  // Đã quyết định (hoặc không rõ kết quả): người duyệt mất quyền đọc → không tải lại chi tiết, chờ chuyển trang.
  const left = decide.isSuccess || (decide.isError && isUncertainOutcome(decide.error));
  const query = useDesign(id, { enabled: canRead && !left });
  useBreadcrumbLabel(id, query.data?.name);
  const back = {
    href: reviewReturnHref(roundId),
    label: roundId ? DESIGN_REVIEW_LABELS.backToRound : DESIGN_REVIEW_LABELS.backToQueue,
  };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={DESIGN_DETAIL_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={DESIGN_DETAIL_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (left || query.isPending) return <PageSkeleton variant="detail" />;
  const design = query.data;

  return (
    // Trang chi tiết kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị, breadcrumb có tên thiết kế.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">Thiết kế {design.name}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <DesignGeneral design={design} now={now} />
          <DesignPreview design={design} onRefresh={() => void query.refetch()} />
          <FilesBlocks design={design} />
          <QuoteRequestsPanel designId={design.id} />
        </div>
        <div className="space-y-5">
          <section className={DETAIL_CARD_CLASS}>
            <div className="mb-4 flex justify-center">
              <StatusDot
                domain="order"
                status={DESIGN_STATUS_TONE_KEY[design.status]}
                label={DESIGN_STATUS_LABELS[design.status]}
                size="md"
              />
            </div>
            <ReviewActions design={design} decide={decide} />
          </section>
          <DesignHistoryPanel designId={design.id} />
        </div>
      </div>
    </div>
  );
}

/** Mở bằng `design-designs:VIEW_PAGE`; nút quyết định chỉ cho người có APPROVE (SALES_STAFF chỉ xem). */
export function DesignReviewDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.viewPage]}>
      <DesignReviewDetailContent id={id} />
    </PermissionBoundary>
  );
}
