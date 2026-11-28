"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, Info } from "lucide-react";

import { PUTAWAY_DETAIL_LABELS } from "@/constants";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";

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
  next,
  listHref,
  tripHref,
}: {
  task: PutawayTask;
  reason: Extract<PutawayTaskGate, { canConfirm: false }>["reason"];
  /** Thùng chờ cất kế tiếp của kho (đã cất xong thùng này): nút đi tiếp một chạm, mang theo ô kệ vừa dùng. */
  next?: { remaining: number; href: string } | null;
  listHref?: string;
  tripHref?: string;
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
        <p className="text-ink-secondary mb-3 text-xs">{L.doneNote}</p>
        {next ? (
          <div className="space-y-2">
            <Link
              href={next.href}
              className={`${DETAIL_ACTION_CLASS.primary} inline-flex h-11 items-center justify-center gap-2 text-sm`}
            >
              {L.nextCarton(next.remaining)}
              <ArrowRight className="size-4" />
            </Link>
            {/* Nhiều thùng cùng lúc: chuyến cất hàng (docs 05 §4.5) — mỗi thùng vẫn quét riêng (BR-08) */}
            {next.remaining >= 2 && tripHref && (
              <p className="text-ink-secondary text-xs">
                {L.tripHint}{" "}
                <Link href={tripHref} className="text-accent-text font-medium hover:underline">
                  {L.openTrip}
                </Link>
              </p>
            )}
          </div>
        ) : (
          listHref && (
            <div className="space-y-2">
              <p className="text-ink-secondary text-xs">{L.nextCartonLast}</p>
              <Link
                href={listHref}
                className={`${DETAIL_ACTION_CLASS.outline} inline-flex h-11 items-center justify-center text-sm`}
              >
                {L.backToList}
              </Link>
            </div>
          )
        )}
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
