"use client";

import { useState } from "react";
import { Download, Send } from "lucide-react";

import { PRODUCER_CHANNEL_LABELS, PRODUCTION_LABELS } from "@/constants";
import { openLink } from "@/lib/files/open-blob";
import { formatDateTime } from "@/lib/format/date";

import { getSlipLink } from "@/features/production-order/api";
import { productionOrderErrorMessage } from "@/features/production-order/errors";

import { DETAIL_CARD_CLASS, DetailCardTitle, InfoRow } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { ConfirmActionDialog } from "./ConfirmActionDialog";

import type { ProductionOrder, ProductionOrderDispatch } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.dispatch;

/**
 * "Gửi cho đơn vị sản xuất" (docs 17 §4.3 bước 7, BR-23): kênh, phiếu PDF đã gửi (link vài phút, kiểm phiếu còn đúng
 * bản đã gửi) và lịch sử mail. `canResend` từ lifecycle (kênh Email, đã gửi, còn mở).
 */
export function DispatchCard({
  order,
  dispatch,
  canResend,
}: {
  order: ProductionOrder;
  dispatch: ProductionOrderDispatch;
  canResend: boolean;
}) {
  const [resending, setResending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openSlip = async () => {
    setOpening(true);
    setError(null);
    try {
      // Link là thông tin xác thực ngắn hạn: mở ngay, không lưu
      openLink(await getSlipLink(order.id));
    } catch (failure: unknown) {
      setError(productionOrderErrorMessage(failure));
    } finally {
      setOpening(false);
    }
  };
  const messages = dispatch.messages.items;

  return (
    <section className={DETAIL_CARD_CLASS} aria-label={L.title}>
      <DetailCardTitle icon={Send}>{L.title}</DetailCardTitle>
      <InfoRow label={L.channel}>{PRODUCER_CHANNEL_LABELS[dispatch.channel]}</InfoRow>
      <InfoRow label={L.slip}>
        {dispatch.slip ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void openSlip()}
            disabled={opening}
          >
            <Download className="size-3.5" /> {opening ? L.downloading : L.downloadSlip}
          </Button>
        ) : (
          <span className="text-ink-tertiary">{L.slipMissing}</span>
        )}
      </InfoRow>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      {dispatch.channel === "PDF" ? (
        <p className="text-ink-tertiary mt-2 text-xs">{L.pdfChannelHint}</p>
      ) : (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-ink-secondary text-xs font-medium">{L.messages}</h3>
            {canResend && (
              <Button type="button" variant="outline" size="sm" onClick={() => setResending(true)}>
                {L.resend}
              </Button>
            )}
          </div>
          {messages.length === 0 ? (
            <p className="text-ink-tertiary text-xs">{L.messagesEmpty}</p>
          ) : (
            <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
              {messages.map((m) => (
                <li key={`${m.generation}-${m.attemptNumber}-${m.message}`} className="py-1.5">
                  <p className="text-ink-primary">
                    {L.message[m.message] ?? m.message} · {L.deliveryStatus[m.status] ?? m.status}
                    {m.failure ? ` · ${m.failure}` : ""}
                  </p>
                  <p className="text-ink-tertiary text-xs tabular-nums">
                    {L.attempt(m.attemptNumber, m.generation)}
                    {m.recipient ? ` · ${m.recipient}` : ""}
                    {m.sentAt || m.attemptedAt
                      ? ` · ${formatDateTime(m.sentAt ?? m.attemptedAt ?? "")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {resending && (
        <ConfirmActionDialog kind="resend" order={order} onClose={() => setResending(false)} />
      )}
    </section>
  );
}
