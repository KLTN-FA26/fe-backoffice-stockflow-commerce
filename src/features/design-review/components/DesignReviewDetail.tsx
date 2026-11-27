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
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { DESIGN_DETAIL_COPY, DESIGN_DETAIL_LABELS } from "./copy";
import { DesignDetailTabs } from "./detail/DesignDetailTabs";
import { DesignOverviewPanel } from "./detail/DesignOverviewPanel";
import { DesignPreview } from "./detail/DesignPreview";
import { PreflightPanel } from "./detail/PreflightPanel";
import { ReviewActions } from "./detail/ReviewActions";
import { SubmittedFiles } from "./detail/SubmittedFiles";
import { ObjectHeader } from "@/components/shared/ObjectPage";

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
    // Object page ERP (backoffice-erp-ui B10): header đối tượng (tên, mã, trạng thái, nút quyết định) → khung hồ sơ →
    // thứ đang duyệt (ảnh | bộ file, kiểm tra file in) hiện thẳng → tab Yêu cầu báo giá / Lịch sử (cùng mẫu trang sản phẩm).
    <div className="surface-soft surface-compact">
      <ObjectHeader
        name={design.name}
        code={design.id}
        codeLabel={DESIGN_DETAIL_LABELS.code}
        status={{
          tone: DESIGN_STATUS_TONE_KEY[design.status],
          label: DESIGN_STATUS_LABELS[design.status] ?? design.status,
        }}
        meta={
          design.projectId ? (
            <span className="text-ink-tertiary">{DESIGN_REVIEW_LABELS.inProject}</span>
          ) : undefined
        }
        actions={<ReviewActions design={design} decide={decide} />}
      />
      <DesignOverviewPanel design={design} now={now} />
      {/* Thứ đang duyệt hiện thẳng: ảnh xem trước (2/5) | bộ file + kiểm tra file in (3/5, đủ chỗ cho tên file). */}
      <div className="grid items-start gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <DesignPreview design={design} onRefresh={() => void query.refetch()} />
        </div>
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <FilesBlocks design={design} />
        </div>
      </div>
      <DesignDetailTabs designId={design.id} />
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
