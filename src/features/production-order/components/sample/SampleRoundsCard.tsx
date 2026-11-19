"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

import { PRODUCTION_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";

import { useSampleRounds } from "@/features/production-order/sample-hooks";
import { sampleRoundActions } from "@/features/production-order/sample-lifecycle";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Alert } from "@/components/shared/Alert";
import { DetailSection } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { PhysicalSampleDialog } from "./PhysicalSampleDialog";
import { SampleMediaDialog } from "./SampleMediaDialog";
import { SampleRoundItem } from "./SampleRoundItem";

import type { ProductionOrder } from "@/features/production-order/types";
import type { SampleMediaMode } from "./SampleMediaDialog";

const S = PRODUCTION_LABELS.sample;

type Dialog = { kind: "media"; mode: SampleMediaMode } | { kind: "physical" };

/**
 * "Vòng mẫu in" trên chi tiết Đơn sản xuất (docs 17 §4.3 bước 9, BR-24): các vòng, số lần in mẫu miễn phí đã dùng (cảnh
 * báo khi vượt — không chặn), và thao tác của Điều phối sản xuất. Đơn không có cờ duyệt mẫu thì chỉ ghi chú.
 */
export function SampleRoundsCard({ order }: { order: ProductionOrder }) {
  const can = usePermissionChecker();
  const rounds = useSampleRounds(order.id, order.sampleApprovalRequired);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const view = rounds.data;
  const actions = view ? sampleRoundActions(view, can) : null;
  const close = () => setDialog(null);
  const button = (label: string, next: Dialog) => (
    <Button type="button" variant="outline" size="sm" onClick={() => setDialog(next)}>
      {label}
    </Button>
  );

  return (
    <DetailSection
      title={S.title}
      icon={Camera}
      actions={
        actions && (
          <>
            {actions.openFirst && button(S.openFirst, { kind: "media", mode: "first" })}
            {actions.openReprint && button(S.openNext, { kind: "media", mode: "reprint" })}
            {actions.waitingRound && button(S.addMedia, { kind: "media", mode: "add" })}
            {actions.waitingRound && button(S.recordPhysical, { kind: "physical" })}
          </>
        )
      }
    >
      {!order.sampleApprovalRequired ? (
        <p className="text-ink-tertiary text-xs">{S.notRequired}</p>
      ) : rounds.isError ? (
        <LoadErrorState
          inline
          error={rounds.error}
          copy={PRODUCTION_LABELS.order.errorCopy}
          onRetry={() => void rounds.refetch()}
        />
      ) : !view ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="space-y-2">
          <p className="text-ink-secondary text-xs tabular-nums">
            {S.freeRounds(view.countedRounds, view.freeSampleRounds ?? null)}
          </p>
          {view.freeRoundsExceeded && <Alert tone="warning">{S.freeExceeded}</Alert>}
          {view.rounds.length === 0 ? (
            <p className="text-ink-tertiary text-xs">{S.empty}</p>
          ) : (
            <ol className="divide-y divide-(--table-line)">
              {[...view.rounds]
                .sort((a, b) => b.roundNo - a.roundNo)
                .map((round) => (
                  <SampleRoundItem key={round.id} orderId={order.id} round={round} />
                ))}
            </ol>
          )}
        </div>
      )}
      {view && dialog?.kind === "media" && (
        <SampleMediaDialog
          mode={dialog.mode}
          view={view}
          roundId={actions?.waitingRound?.id}
          onClose={close}
        />
      )}
      {dialog?.kind === "physical" && actions?.waitingRound && (
        <PhysicalSampleDialog
          orderId={order.id}
          roundId={actions.waitingRound.id}
          initial={actions.waitingRound.physicalSampleSentOn}
          onClose={close}
        />
      )}
    </DetailSection>
  );
}
