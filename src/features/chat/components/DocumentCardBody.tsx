"use client";

import Link from "next/link";

import { ADMIN_ROUTES, QUOTE_STATUS_LABELS, SALES_CONTRACT_STATUS_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { isTransferCard, transferViewFromCard } from "../card-view";
import { payloadNumber, payloadText } from "../selectors";

import { TransferDetails } from "./TransferDetails";

import type { ChatCard } from "../schemas";

const LINK = "text-accent hover:underline";

const label = (labels: Readonly<Record<string, string>>, status: string | null) =>
  status ? labels[status] : undefined;

/** Báo giá: số, tổng, trạng thái của báo giá, hiệu lực đến (BO-UX-48); đã lên đơn thì có link tới đơn. */
function QuoteBody({ card }: { card: ChatCard }) {
  const quoteId = payloadText(card, "quoteId") ?? payloadText(card, "id");
  const total = payloadNumber(card, "acceptedTotal") ?? payloadNumber(card, "proposedTotal");
  const validUntil = payloadText(card, "validUntil");
  const status = label(QUOTE_STATUS_LABELS, payloadText(card, "status"));
  const orderId = payloadText(card, "convertedOrderId");
  return (
    <div className="space-y-1">
      {payloadText(card, "number") && (
        <div className="font-[family-name:var(--font-mono)]">{payloadText(card, "number")}</div>
      )}
      {total != null && (
        <div className="tabular-nums">
          {formatMoney(total, payloadText(card, "currency") ?? "VND")}
        </div>
      )}
      {(status || validUntil) && (
        <div className="text-ink-secondary">
          {status}
          {status && validUntil && " · "}
          {validUntil && `hiệu lực đến ${formatDate(validUntil)}`}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3">
        {quoteId && (
          <Link href={ADMIN_ROUTES.quotes.detail(quoteId)} className={LINK}>
            Mở báo giá
          </Link>
        )}
        {orderId && (
          <Link href={ADMIN_ROUTES.orders.detail(orderId)} className={LINK}>
            Mở đơn {payloadText(card, "convertedOrderNumber") ?? ""}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Hợp đồng: số, tổng, trạng thái; link "Mở hợp đồng" tới khối hợp đồng của đơn (BO-UX-48). */
function ContractBody({ card }: { card: ChatCard }) {
  const orderId = payloadText(card, "orderId");
  const total = payloadNumber(card, "totalAmount");
  const status = label(SALES_CONTRACT_STATUS_LABELS, payloadText(card, "status"));
  return (
    <div className="space-y-1">
      {payloadText(card, "number") && (
        <div className="font-[family-name:var(--font-mono)]">{payloadText(card, "number")}</div>
      )}
      {total != null && (
        <div className="tabular-nums">
          {formatMoney(total, payloadText(card, "currency") ?? "VND")}
        </div>
      )}
      {status && <div className="text-ink-secondary">{status}</div>}
      {orderId && (
        <Link href={ADMIN_ROUTES.orders.contract(orderId)} className={LINK}>
          Mở hợp đồng
        </Link>
      )}
    </div>
  );
}

/** Thẻ khác (hoá đơn, trạng thái đơn, duyệt mẫu…): số chứng từ, số tiền, link tới đơn. */
function OtherBody({ card }: { card: ChatCard }) {
  const number =
    payloadText(card, "number") ?? payloadText(card, "code") ?? payloadText(card, "orderNumber");
  const amount = payloadNumber(card, "grandTotal") ?? payloadNumber(card, "amount");
  const orderId = payloadText(card, "orderId") ?? payloadText(card, "salesOrderId");
  return (
    <div className="space-y-1">
      {number && <div className="font-[family-name:var(--font-mono)]">{number}</div>}
      {amount != null && (
        <div className="tabular-nums">
          {formatMoney(amount, payloadText(card, "currency") ?? "VND")}
        </div>
      )}
      {orderId && (
        <Link href={ADMIN_ROUTES.orders.detail(orderId)} className={LINK}>
          Mở đơn
        </Link>
      )}
    </div>
  );
}

/** Thân thẻ chứng từ theo `card.kind`; thẻ chuyển khoản hiện đủ trường khách nhận (BO-UX-45). */
export function DocumentCardBody({ card }: { card: ChatCard }) {
  if (card.kind === "QUOTE") return <QuoteBody card={card} />;
  if (card.kind === "CONTRACT") return <ContractBody card={card} />;
  if (isTransferCard(card.kind)) return <TransferDetails view={transferViewFromCard(card)} />;
  return <OtherBody card={card} />;
}
