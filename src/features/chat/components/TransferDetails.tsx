"use client";

import { QRCodeSVG } from "qrcode.react";

import { CHAT_TRANSFER_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import type { TransferView } from "../card-view";

/**
 * VietQR of an installment (16 §4.4 step 9, BR-06): the BE sends the finished EMVCo/NAPAS string; the FE only draws
 * it. Dark on a light tile in both themes, or banking apps cannot read it.
 */
export function VietQrCode({ payload }: { payload: string }) {
  return (
    <figure className="border-border-default bg-bg-surface flex w-fit flex-col items-center gap-2 rounded-[var(--r-md)] border p-3">
      <QRCodeSVG
        value={payload}
        size={152}
        level="M"
        marginSize={2}
        title={CHAT_TRANSFER_LABELS.qrLabel}
        role="img"
        aria-label={CHAT_TRANSFER_LABELS.qrLabel}
      />
      <figcaption className="text-ink-secondary max-w-[14rem] text-center text-xs">
        {CHAT_TRANSFER_LABELS.qrCaption}
      </figcaption>
    </figure>
  );
}

/**
 * The transfer details a PAYMENT_INFO / PAYMENT_REMINDER card gives the customer (BO-UX-45): the same fields in the
 * send dialog's preview and in the staff view of the card, so Sales can check what the customer was told to pay.
 */
export function TransferDetails({
  view,
  noQrNote = null,
}: {
  view: TransferView;
  /** Said where the QR would be when there is none (the preview, before the BE draws it). */
  noQrNote?: string | null;
}) {
  const L = CHAT_TRANSFER_LABELS;
  const hasBank = !!(view.bankName || view.accountNumber);
  return (
    <div className="space-y-2">
      {view.title && <div className="text-ink-primary font-medium">{view.title}</div>}
      {!hasBank && <p className="text-warning">{L.noBank}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {hasBank && (
          <>
            <dt className="text-ink-tertiary">{L.bank}</dt>
            <dd>{view.bankName ?? "—"}</dd>
            <dt className="text-ink-tertiary">{L.account}</dt>
            <dd className="font-[family-name:var(--font-mono)] tabular-nums">
              {view.accountNumber ?? "—"}
            </dd>
            <dt className="text-ink-tertiary">{L.holder}</dt>
            <dd>{view.accountName ?? "—"}</dd>
          </>
        )}
        <dt className="text-ink-tertiary">{L.amount}</dt>
        <dd className="font-medium tabular-nums">
          {view.amount != null ? formatMoney(view.amount, view.currency) : "—"}
        </dd>
        <dt className="text-ink-tertiary">{L.content}</dt>
        <dd className="font-[family-name:var(--font-mono)]">{view.content ?? "—"}</dd>
        {view.dueDate && (
          <>
            <dt className="text-ink-tertiary">{L.dueDate}</dt>
            <dd className="tabular-nums">{formatDate(view.dueDate)}</dd>
          </>
        )}
      </dl>
      {view.vietQr ? (
        <VietQrCode payload={view.vietQr} />
      ) : (
        noQrNote && <p className="text-ink-tertiary text-xs">{noQrNote}</p>
      )}
    </div>
  );
}
