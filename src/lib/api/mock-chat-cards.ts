/**
 * Thẻ do hệ thống / Sale đăng vào hội thoại trong mock chat (WF-02, chỉ USE_MOCK=true). Chép BE origin/develop:
 * `DocumentCards.transferPayload` + `chat/internal/domain/VietQr` (thẻ chuyển khoản, 16 BR-06), `StaffChatService.
 * askForRating` (thẻ CSAT khi RESOLVED), `DocumentCards.designRequestPayload` (thẻ yêu cầu báo giá trên thiết kế),
 * `ChatCardActions.staffAct` (CREATE_QUOTE → ACTED, kèm `quoteId` / `quoteNumber`).
 */

import { CHAT_COMPANY_BANK, CHAT_SEED, DS02A_DESIGN_REQUEST } from "./mock-chat-seed";
import { attachContextRow, chatState, postMessage } from "./mock-chat-store";

import type { MockChatInstallment, MockChatMessage, MockConversation } from "./mock-chat-seed";

const QR_CONTENT_MAX = 50;

const field = (id: string, value: string) =>
  `${id}${String(new TextEncoder().encode(value).length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) — trường 63 của EMVCo. */
function crc16(data: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(data)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nội dung chuyển khoản ASCII (bỏ dấu, chỉ chữ / số / ` -._/`, tối đa 50 ký tự) như `VietQr.ascii`. */
function asciiContent(content: string): string {
  const plain = content
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 \-._/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > QR_CONTENT_MAX ? plain.slice(0, QR_CONTENT_MAX).trim() : plain;
}

/** Chuỗi VietQR (NAPAS / EMVCo) của một lần chuyển `amount` đồng vào tài khoản công ty. */
export function vietQrPayload(bin: string, account: string, amount: number, content: string) {
  const beneficiary = field("00", bin) + field("01", account.replace(/\s/g, ""));
  const text = asciiContent(content);
  const qr =
    field("00", "01") +
    field("01", "12") +
    field("38", field("00", "A000000727") + field("01", beneficiary) + field("02", "QRIBFTTA")) +
    field("53", "704") +
    field("54", String(Math.ceil(amount))) +
    field("58", "VN") +
    (text ? field("62", field("08", text)) : "") +
    "6304";
  return qr + crc16(qr);
}

/** `HD-... DOT2`: số hợp đồng + thứ tự đợt, kế toán khớp tiền theo nội dung này. */
export const transferReference = (i: MockChatInstallment) => `${i.contractNumber} DOT${i.seq}`;

export function transferPayload(
  i: MockChatInstallment & { overdue: boolean },
  reminder: boolean,
): Record<string, unknown> {
  const outstanding = i.amount - i.paidAmount;
  const bank = CHAT_COMPANY_BANK;
  const payable = outstanding > 0 && i.currency === "VND";
  return {
    installmentId: i.id,
    contractId: i.contractId,
    contractNumber: i.contractNumber,
    orderId: i.orderId,
    orderNumber: i.orderNumber,
    seq: i.seq,
    name: i.name,
    amount: outstanding,
    installmentAmount: i.amount,
    currency: i.currency,
    dueDate: i.dueDate,
    overdue: i.overdue,
    status: i.status,
    transferContent: transferReference(i),
    reminder,
    bank: { ...bank },
    vietQr: payable
      ? vietQrPayload(bank.bankBin, bank.accountNumber, outstanding, transferReference(i))
      : null,
  };
}

/** S18: thẻ chuyển khoản (kèm gắn hợp đồng của đợt làm ngữ cảnh), người gửi là Sale. */
export function postTransferCard(
  c: MockConversation,
  i: MockChatInstallment & { overdue: boolean },
  reminder: boolean,
  senderId: string,
): MockChatMessage {
  const contextId = attachContextRow(c, "CONTRACT", i.contractId);
  return postMessage(c, {
    kind: "CARD",
    visibility: "CUSTOMER",
    senderType: "AGENT",
    senderId,
    body: `${reminder ? "Nhắc thanh toán " : "Thông tin chuyển khoản "}${transferReference(i)}`,
    clientMessageId: null,
    contextId,
    card: {
      kind: reminder ? "PAYMENT_REMINDER" : "PAYMENT_INFO",
      state: "OPEN",
      payload: transferPayload(i, reminder),
      updatedAt: null,
    },
    attachments: [],
    mentions: [],
  });
}

/** S12 → RESOLVED: phiếu CSAT mới, thay phiếu còn mở của lần giải quyết trước (SUPERSEDED). */
export function postCsatCard(c: MockConversation, now = Date.now()): MockChatMessage {
  for (const m of chatState().messages) {
    if (m.conversationId === c.id && m.card?.kind === "CSAT_SURVEY" && m.card.state === "OPEN")
      m.card = { ...m.card, state: "SUPERSEDED", updatedAt: new Date(now).toISOString() };
  }
  return postMessage(
    c,
    {
      kind: "CARD",
      visibility: "CUSTOMER",
      senderType: "SYSTEM",
      senderId: null,
      body: "Anh/chị hài lòng với hỗ trợ lần này chứ?",
      clientMessageId: null,
      contextId: null,
      card: {
        kind: "CSAT_SURVEY",
        state: "OPEN",
        payload: { conversationId: c.id, scale: 5 },
        updatedAt: null,
      },
      attachments: [],
      mentions: [],
    },
    now,
  );
}

/**
 * Thẻ BE đăng khi khách bấm "Yêu cầu báo giá" trên thiết kế đã duyệt của DS-02a (A-1, `DesignQuoteRequested`), vào hội
 * thoại DS-02a đang nói về thiết kế đó. Storefront ở repo khác nên mock back-office không tự sinh: dùng cho test và để
 * nối với mock phía khách khi có.
 */
export function postDesignQuoteRequestCard(
  input: { cartons: number; desiredDeliveryDate: string | null },
  now = Date.now(),
): MockChatMessage | null {
  const c = chatState().conversations.find((x) => x.id === CHAT_SEED.ds02a);
  if (!c) return null;
  return postMessage(
    c,
    {
      kind: "CARD",
      visibility: "CUSTOMER",
      senderType: "SYSTEM",
      senderId: null,
      body: `Yêu cầu báo giá: ${DS02A_DESIGN_REQUEST.designName}`,
      clientMessageId: null,
      contextId: CHAT_SEED.ds02aDesignContext,
      card: {
        kind: "QUOTE_REQUEST",
        state: "OPEN",
        updatedAt: null,
        payload: {
          scope: "DESIGN",
          requestId: crypto.randomUUID(),
          designId: CHAT_SEED.design,
          designName: DS02A_DESIGN_REQUEST.designName,
          designStatus: "APPROVED",
          sku: DS02A_DESIGN_REQUEST.sku,
          customerSku: DS02A_DESIGN_REQUEST.customerSku,
          returnReason: null,
          cartons: input.cartons,
          desiredDeliveryDate: input.desiredDeliveryDate,
          requestStatus: "OPEN",
          requestedAt: new Date(now).toISOString(),
        },
      },
      attachments: [],
      mentions: [],
    },
    now,
  );
}

/**
 * S17 CREATE_QUOTE: thẻ → ACTED, yêu cầu → CLOSED, gắn báo giá làm ngữ cảnh. BE lập một báo giá NHÁP mới
 * (`QuoteCards.draft`); mock chưa có kho báo giá chung nên ghi id / số báo giá của seed (QT-20261120-9001).
 */
export function actCreateQuote(c: MockConversation, card: MockChatMessage, now = Date.now()) {
  if (!card.card) return card;
  const project = card.card.payload.scope === "PROJECT";
  card.card = {
    ...card.card,
    state: "ACTED",
    updatedAt: new Date(now).toISOString(),
    payload: {
      ...card.card.payload,
      ...(project ? { status: "CLOSED" } : { requestStatus: "CLOSED" }),
      quoteId: CHAT_SEED.quote,
      quoteNumber: CHAT_SEED.quoteNumber,
    },
  };
  attachContextRow(c, "QUOTE", CHAT_SEED.quote, now);
  return card;
}
