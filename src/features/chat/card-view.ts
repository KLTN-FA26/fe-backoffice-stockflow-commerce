/**
 * Chat cards — pure reading of a card for the staff view (BO-UX-6, -45, -48): its kind and state in words (never a raw
 * BE code), and the transfer details the customer was (or will be) told, read the same way from the card's payload
 * (`DocumentCards.transferPayload`) and from the installment's transfer instructions (the dialog's preview).
 */

import {
  CHAT_CARD_ACTED_LABELS,
  CHAT_CARD_LABELS,
  CHAT_CARD_STATE_LABELS,
  CHAT_CARD_STATE_TONE_KEY,
  CHAT_QUOTE_ACTED_VIEW,
  CHAT_UNKNOWN_LABELS,
} from "@/constants";
import { FEE_ITEM_NAME_LABELS, INSTALLMENT_MILESTONE_LABELS } from "@/constants/labels-payment";
import { FEE_INSTALLMENT_SEQ } from "@/constants/payment";

import { payloadNumber, payloadText } from "./selectors";

import type { ChatCard, TransferInstructions } from "./schemas";

export function cardKindLabel(kind: string): string {
  return CHAT_CARD_LABELS[kind] ?? CHAT_UNKNOWN_LABELS.card;
}

/**
 * The card's state for a StatusDot: the kind's own word for "acted on" (accepted, signed, paid…), else the state's. An
 * acted quote card reads its outcome from `payload.status` (FE-9): changes requested or turned into an order.
 */
export function cardStateView(card: Pick<ChatCard, "kind" | "state" | "payload">): {
  label: string;
  toneKey: string;
} {
  const quoteStatus = card.kind === "QUOTE" && card.state === "ACTED" ? card.payload?.status : null;
  const quoteView =
    typeof quoteStatus === "string" ? CHAT_QUOTE_ACTED_VIEW[quoteStatus] : undefined;
  if (quoteView) return quoteView;
  const label =
    (card.state === "ACTED" ? CHAT_CARD_ACTED_LABELS[card.kind] : undefined) ??
    CHAT_CARD_STATE_LABELS[card.state] ??
    CHAT_UNKNOWN_LABELS.state;
  return { label, toneKey: CHAT_CARD_STATE_TONE_KEY[card.state] ?? "Draft" };
}

export interface TransferView {
  /** `HD-… — đợt 2 Thanh toán sau giao hàng`. */
  title: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  amount: number | null;
  currency: string;
  content: string | null;
  dueDate: string | null;
  /** EMVCo/NAPAS payload drawn by the BE; null when nothing is payable or the bank has no BIN. */
  vietQr: string | null;
}

/**
 * FE-7: a fee item (seq 21–40, BE `Installment.FIRST_FEE_SEQ`..`LAST_FEE_SEQ`) is not a step of the plan, so it is never
 * "đợt 21" - only its name, the BE's English fee name in Vietnamese. The card carries no milestone, so the seq decides.
 */
const isFeeSeq = (seq: number | null) =>
  seq != null && seq >= FEE_INSTALLMENT_SEQ.first && seq <= FEE_INSTALLMENT_SEQ.last;

const installmentTitle = (
  number: string | null | undefined,
  seq: number | null,
  rawName: string | null | undefined,
) => {
  const name = rawName ? (FEE_ITEM_NAME_LABELS[rawName.trim()] ?? rawName) : rawName;
  const part = isFeeSeq(seq)
    ? (name ?? INSTALLMENT_MILESTONE_LABELS.CANCELLATION_FEE)
    : seq != null
      ? `đợt ${seq}${name ? ` ${name}` : ""}`
      : name;
  return [number, part].filter(Boolean).join(" — ") || null;
};

function bankField(card: ChatCard, key: string): string | null {
  const bank = card.payload?.bank;
  if (!bank || typeof bank !== "object") return null;
  const value = (bank as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

/** A PAYMENT_INFO / PAYMENT_REMINDER card's payload, as the customer sees it. */
export function transferViewFromCard(card: ChatCard): TransferView {
  return {
    title: installmentTitle(
      payloadText(card, "contractNumber") ?? payloadText(card, "orderNumber"),
      payloadNumber(card, "seq"),
      payloadText(card, "name"),
    ),
    bankName: bankField(card, "bankName"),
    accountNumber: bankField(card, "accountNumber"),
    accountName: bankField(card, "accountName"),
    amount: payloadNumber(card, "amount"),
    currency: payloadText(card, "currency") ?? "VND",
    content: payloadText(card, "transferContent"),
    dueDate: payloadText(card, "dueDate"),
    vietQr: payloadText(card, "vietQr"),
  };
}

/** The installment's transfer instructions: what the card will carry once sent. */
export function transferViewFromInstructions(instructions: TransferInstructions): TransferView {
  return {
    title: installmentTitle(
      instructions.contractNumber ?? instructions.orderNumber,
      instructions.seq,
      instructions.name,
    ),
    bankName: instructions.bankName ?? null,
    accountNumber: instructions.accountNumber ?? null,
    accountName: instructions.accountName ?? null,
    amount: instructions.amountDue,
    currency: instructions.currency,
    content: instructions.reference ?? null,
    dueDate: instructions.dueDate ?? null,
    vietQr: instructions.vietQr ?? null,
  };
}

export function isTransferCard(kind: string): boolean {
  return kind === "PAYMENT_INFO" || kind === "PAYMENT_REMINDER";
}
