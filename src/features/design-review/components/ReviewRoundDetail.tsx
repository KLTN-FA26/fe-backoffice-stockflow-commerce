"use client";

import { useState } from "react";

import { ADMIN_ROUTES, DESIGN_PERMISSIONS, DESIGN_ROUND_LABELS } from "@/constants";

import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { designReviewErrorMessage, isUncertainOutcome } from "@/features/design-review/errors";
import { useApproveRound } from "@/features/design-review/mutations";
import { useReviewRound } from "@/features/design-review/queries";
import {
  pendingInRound,
  ROUND_APPROVE_BATCH_MAX,
  roundProgress,
  waitingSince,
} from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { REVIEW_ROUNDS_COPY, ROUND_DETAIL_LABELS as L } from "./copy";
import {
  LifecycleSteps,
  ObjectHeader,
  ProfileFact,
  ProfileFrame,
} from "@/components/shared/ObjectPage";
import { RoundApprovalResult } from "./RoundApprovalResult";
import { RoundDesignsPanel } from "./RoundDesignsPanel";

import type { RoundApprovalOutcome } from "@/features/design-review/types";

function ReviewRoundDetailContent({ roundId }: { roundId: string }) {
  const canApprove = useCan(DESIGN_PERMISSIONS.approve);
  const query = useReviewRound(roundId, { enabled: canApprove });
  const approve = useApproveRound(roundId);
  const [confirming, setConfirming] = useState(false);
  const [outcomes, setOutcomes] = useState<RoundApprovalOutcome[] | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  useBreadcrumbLabel(roundId, query.data?.projectName);
  const back = { href: ADMIN_ROUTES.designReviewRounds.list, label: "Về danh sách vòng duyệt" };

  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={REVIEW_ROUNDS_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const round = query.data;
  const pending = pendingInRound(round);
  // The BE takes 1-20 designs per request: the first 20 now, the rest on the next "Duyệt tất cả".
  const batch = pending.slice(0, ROUND_APPROVE_BATCH_MAX);
  const rest = pending.length - batch.length;
  const open = round.closedAt == null;
  const running = approve.isPending;
  const progress = roundProgress(round);
  const tabular = (text: string) => <span className="tabular-nums">{text}</span>;

  const submit = () => {
    setDialogError(null);
    approve.mutate(
      { roundId, designs: batch },
      {
        onSuccess: (result) => {
          setOutcomes(result.outcomes);
          setConfirming(false);
        },
        onError: (error) => {
          // Không rõ kết quả: không gửi lại; hook đã tải lại vòng.
          // The table of the earlier run would now be stale (the round was reloaded): drop it.
          if (isUncertainOutcome(error)) {
            setOutcomes(null);
            setConfirming(false);
          } else setDialogError(designReviewErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="surface-soft surface-compact">
      {/* Đang duyệt: khoá cả trang (hộp xác nhận nằm ngoài vùng này). */}
      <div inert={running}>
        {/* Object page ERP (backoffice-erp-ui B10): header đối tượng → khung hồ sơ → bảng thiết kế hiện thẳng. */}
        <ObjectHeader
          name={round.projectName}
          code={round.id}
          codeLabel={L.code}
          status={
            open
              ? { tone: "PENDING_APPROVAL", label: DESIGN_ROUND_LABELS.statusOpen }
              : { tone: "CLOSED", label: DESIGN_ROUND_LABELS.statusClosed }
          }
          actions={
            open && canApprove ? (
              <Button size="sm" disabled={pending.length === 0} onClick={() => setConfirming(true)}>
                {DESIGN_ROUND_LABELS.approveAll} ({pending.length})
              </Button>
            ) : undefined
          }
        />
        <ProfileFrame
          label={L.profile}
          head={
            <LifecycleSteps
              label={L.lifecycle}
              steps={[DESIGN_ROUND_LABELS.statusOpen, DESIGN_ROUND_LABELS.statusClosed]}
              current={open ? 0 : 1}
            />
          }
        >
          <ProfileFact label={L.customer}>
            <CustomerName id={round.customerId} name={round.customerName} />
          </ProfileFact>
          <ProfileFact label={L.submittedAt}>
            {tabular(formatDateTime(round.submittedAt))}
          </ProfileFact>
          <ProfileFact label={L.waiting}>
            {open ? (waitingSince({ reviewRequestedAt: round.submittedAt }, now) ?? "—") : "—"}
          </ProfileFact>
          <ProfileFact label={L.closedAt}>
            {round.closedAt ? tabular(formatDateTime(round.closedAt)) : "—"}
          </ProfileFact>
          <ProfileFact label={L.designCount}>{tabular(String(round.designs.length))}</ProfileFact>
          <ProfileFact label={L.approved}>{tabular(String(progress.approved))}</ProfileFact>
          <ProfileFact label={L.returned}>{tabular(String(progress.returned))}</ProfileFact>
          <ProfileFact label={L.waitingCount}>{tabular(String(progress.waiting))}</ProfileFact>
        </ProfileFrame>
        {outcomes && <RoundApprovalResult result={outcomes} round={round} />}
        <RoundDesignsPanel
          roundId={roundId}
          designs={round.designs}
          canApprove={canApprove}
          onRefreshPreview={() => void query.refetch()}
        />
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !running && setConfirming(next)}
        title={DESIGN_ROUND_LABELS.confirmTitle}
        description={`Duyệt lần lượt ${batch.length} thiết kế còn chờ. Thiết kế nào không duyệt được sẽ vẫn chờ.`}
        confirmLabel={DESIGN_ROUND_LABELS.approveAll}
        variant="default"
        loading={running}
        closeOnConfirm={false}
        error={dialogError}
        onConfirm={submit}
      >
        {running && (
          <p role="status" className="text-ink-secondary text-[0.8125rem]">
            {DESIGN_ROUND_LABELS.running.replace("{n}", String(batch.length))}
          </p>
        )}
        {rest > 0 && (
          <p className="text-ink-secondary text-[0.8125rem]">
            {DESIGN_ROUND_LABELS.batchRest
              .replace("{max}", String(ROUND_APPROVE_BATCH_MAX))
              .replace("{rest}", String(rest))}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Vòng duyệt cần `design-designs:APPROVE` (BE `DesignReviewRoundController`). */
export function ReviewRoundDetail({ roundId }: { roundId: string }) {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.approve]}>
      <ReviewRoundDetailContent roundId={roundId} />
    </PermissionBoundary>
  );
}
