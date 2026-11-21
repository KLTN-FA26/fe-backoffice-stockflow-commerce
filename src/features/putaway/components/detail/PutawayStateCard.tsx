"use client";

import { CircleCheck, Info } from "lucide-react";

import { PUTAWAY_DETAIL_LABELS } from "@/constants";
import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";

import type { PutawayTaskGate } from "@/features/putaway/lifecycle";
import type { PutawayTask } from "@/features/putaway/types";

const L = PUTAWAY_DETAIL_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

/**
 * Cột phải khi không xác nhận được: đã cất (nêu bin, BR-06 chỉnh qua chuyển vị trí), nhiệm vụ đã đóng, hoặc chỉ có
 * quyền xem. Không render nút ghi nào (action-gating: terminal → ẩn mọi nút mutating).
 */
export function PutawayStateCard({
  task,
  reason,
}: {
  task: PutawayTask;
  reason: Extract<PutawayTaskGate, { canConfirm: false }>["reason"];
}) {
  if (reason === "done") {
    return (
      <section className={DETAIL_CARD_CLASS}>
        <DetailCardTitle icon={CircleCheck}>{L.doneTitle}</DetailCardTitle>
        <dl className="mb-3 text-[0.8125rem]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-secondary">{L.target}</dt>
            <dd className={`text-ink-primary font-medium ${MONO}`}>
              {task.targetLocationCode ?? "—"}
            </dd>
          </div>
        </dl>
        <p className="text-ink-secondary text-xs">{L.doneNote}</p>
      </section>
    );
  }
  return (
    <section className={DETAIL_CARD_CLASS}>
      <DetailCardTitle icon={Info}>{L.confirmTitle}</DetailCardTitle>
      <p className="text-ink-secondary text-[0.8125rem]">
        {reason === "closed" ? L.cancelledNote : L.readOnly}
      </p>
    </section>
  );
}
