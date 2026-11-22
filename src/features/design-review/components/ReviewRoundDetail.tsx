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
import { pendingInRound, ROUND_APPROVE_BATCH_MAX } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { BackLink } from "@/components/shared/BackLink";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { REVIEW_ROUNDS_COPY } from "./copy";
import { RoundApprovalResult } from "./RoundApprovalResult";
import { RoundDesignCard } from "./RoundDesignCard";

import type { RoundApprovalOutcome } from "@/features/design-review/types";

function ReviewRoundDetailContent({ roundId }: { roundId: string }) {
  const canApprove = useCan(DESIGN_PERMISSIONS.approve);
  const query = useReviewRound(roundId, { enabled: canApprove });
  const approve = useApproveRound(roundId);
  const [confirming, setConfirming] = useState(false);
  const [outcomes, setOutcomes] = useState<RoundApprovalOutcome[] | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
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
    <div className="surface-soft surface-compact space-y-5">
      {/* Đang duyệt: khoá cả trang (hộp xác nhận nằm ngoài vùng này). */}
      <div inert={running} className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <BackLink href={back.href} label={back.label} />
            <h1 className="text-ink-primary text-lg font-semibold">{round.projectName}</h1>
            <p className="text-ink-secondary text-[0.8125rem]">
              <CustomerName id={round.customerId} name={round.customerName} /> · Gửi lúc{" "}
              <span className="tabular-nums">{formatDateTime(round.submittedAt)}</span> ·{" "}
              {open
                ? DESIGN_ROUND_LABELS.statusOpen
                : `${DESIGN_ROUND_LABELS.statusClosed} lúc ${formatDateTime(round.closedAt ?? "")}`}
            </p>
          </div>
          {open && canApprove && (
            <Button disabled={pending.length === 0} onClick={() => setConfirming(true)}>
              {DESIGN_ROUND_LABELS.approveAll} ({pending.length})
            </Button>
          )}
        </header>
        {outcomes && <RoundApprovalResult result={outcomes} round={round} />}
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {round.designs.map((entry) => (
            <RoundDesignCard
              key={entry.designId}
              entry={entry}
              roundId={roundId}
              onRefreshPreview={() => void query.refetch()}
            />
          ))}
        </ul>
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
