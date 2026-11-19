"use client";

import { useState } from "react";
import { Film, Image as ImageIcon } from "lucide-react";

import { PRODUCTION_LABELS, REPRINT_REASON_LABELS, SAMPLE_ROUND_RESULT_LABELS } from "@/constants";
import { openLink } from "@/lib/files/open-blob";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { getSampleMediaLink } from "@/features/production-order/sample-api";

import { ToneDot } from "@/components/shared/column-helpers";

import type { SampleRound } from "@/features/production-order/sample-schemas";

const S = PRODUCTION_LABELS.sample;

function resultTone(round: SampleRound) {
  if (round.result === "APPROVED") return "positive" as const;
  if (round.result === "REPRINT_REQUESTED") return "warning" as const;
  return "info" as const;
}

/** Một vòng mẫu: số vòng, kết quả, lý do in lại (+ có tính vào số lần miễn phí không), mẫu vật, ghi chú khách, tệp. */
export function SampleRoundItem({ orderId, round }: { orderId: string; round: SampleRound }) {
  const [error, setError] = useState<string | null>(null);
  const view = async (mediaId: string) => {
    setError(null);
    try {
      // Link vài phút — mở ngay, không lưu (BE no-store)
      openLink(await getSampleMediaLink(orderId, round.id, mediaId));
    } catch (failure: unknown) {
      setError(`${S.viewFailed} ${productionOrderErrorMessage(failure)}`);
    }
  };
  const meta = [
    round.reprintReason
      ? `${S.reprintReason}: ${REPRINT_REASON_LABELS[round.reprintReason]}`
      : null,
    round.counted ? S.counted : S.notCounted,
    round.physicalSampleSentOn
      ? `${S.physicalSentOn} ${formatDate(round.physicalSampleSentOn)}`
      : null,
    `${S.openedAt} ${formatDateTime(round.openedAt)}`,
    round.answeredAt ? `${S.answeredAt} ${formatDateTime(round.answeredAt)}` : null,
  ].filter(Boolean);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-ink-primary text-[0.8125rem] font-semibold">
          {S.round(round.roundNo)}
        </span>
        <ToneDot
          tone={resultTone(round)}
          label={round.result ? SAMPLE_ROUND_RESULT_LABELS[round.result] : S.waiting}
        />
      </div>
      <p className="text-ink-tertiary mt-1 text-xs">{meta.join(" · ")}</p>
      {round.customerNote && (
        <p className="text-ink-secondary mt-1 text-[0.8125rem] whitespace-pre-line">
          {S.customerNote}: {round.customerNote}
        </p>
      )}
      {round.media.length === 0 ? (
        <p className="text-ink-tertiary mt-1 text-xs">{S.mediaEmpty}</p>
      ) : (
        <ul
          className="mt-2 flex flex-wrap gap-2"
          aria-label={`${S.media} ${S.round(round.roundNo)}`}
        >
          {round.media.map((media) => (
            <li key={media.id}>
              <button
                type="button"
                onClick={() => void view(media.id)}
                className="border-border-default hover:bg-bg-muted text-ink-secondary inline-flex max-w-[16rem] items-center gap-1.5 rounded-[var(--r-sm)] border px-2 py-1 text-xs"
                aria-label={`${S.view} ${media.fileName}`}
              >
                {media.video ? <Film className="size-3.5" /> : <ImageIcon className="size-3.5" />}
                <span className="truncate">{media.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </li>
  );
}
