"use client";

import {
  ADMIN_ROUTES,
  ORDER_PERMISSIONS,
  QUOTE_PERMISSIONS,
  QUOTE_STATUS_LABELS,
  SALES_CONTRACT_STATUS_LABELS,
} from "@/constants";
import { CHAT_INBOX_LABELS } from "@/constants/labels-chat";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { PermittedLink } from "@/components/backoffice/PermittedLink";

import { isTransferCard, transferViewFromCard } from "../card-view";
import { chatStatusWord } from "../inbox-view";
import { payloadNumber, payloadText } from "../selectors";

import { ShortageCardBody } from "./ShortageCardBody";
import { TransferDetails } from "./TransferDetails";

import type { ChatCard } from "../schemas";

const LINK = "text-accent-text hover:underline";

const label = (labels: Readonly<Record<string, string>>, status: string | null) =>
  status ? labels[status] : undefined;

/**
 * Báo giá: số, tổng, trạng thái của báo giá, hiệu lực đến (BO-UX-48); đã lên đơn thì có link tới đơn. Link chỉ hiện khi
 * mở được trang đích (VIEW_PAGE, AUTH-8); số chứng từ đã in trên thẻ nên thiếu quyền thì bỏ chữ "Mở …".
 */
function QuoteBody({ card }: { card: ChatCard }) {
  const quoteId = payloadText(card, "quoteId") ?? payloadText(card, "id");
  const total = payloadNumber(card, "acceptedTotal") ?? payloadNumber(card, "proposedTotal");
  const validUntil = payloadText(card, "validUntil");
  const status = label(QUOTE_STATUS_LABELS, payloadText(card, "status"));
  const orderId = payloadText(card, "convertedOrderId");
  const orderNumber = payloadText(card, "convertedOrderNumber");
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
          <PermittedLink
            permission={QUOTE_PERMISSIONS.viewPage}
            href={ADMIN_ROUTES.quotes.detail(quoteId)}
            className={LINK}
            fallback={null}
          >
            Mở báo giá
          </PermittedLink>
        )}
        {orderId && (
          <PermittedLink
            permission={ORDER_PERMISSIONS.viewPage}
            href={ADMIN_ROUTES.orders.detail(orderId)}
            className={LINK}
            fallback={
              orderNumber && <span className="text-ink-secondary">Đã lên đơn {orderNumber}</span>
            }
          >
            Mở đơn {orderNumber ?? ""}
          </PermittedLink>
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
        <PermittedLink
          permission={ORDER_PERMISSIONS.viewPage}
          href={ADMIN_ROUTES.orders.contract(orderId)}
          className={LINK}
          fallback={null}
        >
          Mở hợp đồng
        </PermittedLink>
      )}
    </div>
  );
}

/**
 * Thẻ khác (hoá đơn, trạng thái đơn, duyệt mẫu…): số chứng từ, số tiền, link tới đơn. Thẻ trạng thái đơn ghi trạng thái
 * lô giao bằng chữ (bo-32: không lộ `DELIVERED`).
 */
function OtherBody({ card }: { card: ChatCard }) {
  const number =
    payloadText(card, "number") ?? payloadText(card, "code") ?? payloadText(card, "orderNumber");
  const rawStatus = card.kind === "ORDER_STATUS" ? payloadText(card, "status") : null;
  const shipmentStatus = rawStatus ? (chatStatusWord(rawStatus) ?? rawStatus) : null;
  const amount = payloadNumber(card, "grandTotal") ?? payloadNumber(card, "amount");
  const orderId = payloadText(card, "orderId") ?? payloadText(card, "salesOrderId");
  return (
    <div className="space-y-1">
      {number && <div className="font-[family-name:var(--font-mono)]">{number}</div>}
      {shipmentStatus && (
        <div className="text-ink-secondary">
          {CHAT_INBOX_LABELS.shipment}: {shipmentStatus}
        </div>
      )}
      {amount != null && (
        <div className="tabular-nums">
          {formatMoney(amount, payloadText(card, "currency") ?? "VND")}
        </div>
      )}
      {orderId && (
        <PermittedLink
          permission={ORDER_PERMISSIONS.viewPage}
          href={ADMIN_ROUTES.orders.detail(orderId)}
          className={LINK}
          fallback={null}
        >
          Mở đơn
        </PermittedLink>
      )}
    </div>
  );
}

/** Thân thẻ chứng từ theo `card.kind`; thẻ chuyển khoản hiện đủ trường khách nhận (BO-UX-45). */
export function DocumentCardBody({ card }: { card: ChatCard }) {
  if (card.kind === "QUOTE") return <QuoteBody card={card} />;
  if (card.kind === "CONTRACT") return <ContractBody card={card} />;
  if (card.kind === "SHORTAGE_CHOICE") return <ShortageCardBody card={card} />;
  if (isTransferCard(card.kind)) return <TransferDetails view={transferViewFromCard(card)} />;
  return <OtherBody card={card} />;
}
