/**
 * Hộp thư của Sale — cách đọc một dòng (UI/UX bo-32), hàm thuần: tin cuối không lộ mã trạng thái tiếng Anh của BE, giờ
 * ngắn không xuống dòng. Panel khách (bo-33): chỉ báo giá / đơn còn đang mở.
 */

import {
  CHAT_CLOSED_ORDER_STATUSES,
  CHAT_INBOX_LABELS,
  CHAT_OPEN_QUOTE_STATUSES,
} from "@/constants/labels-chat";
import { REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";
import { PACK_SHIPMENT_STATUS_DISPLAY } from "@/constants/statuses";
import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { statusLabelVi } from "@/lib/status-map";

import { payloadText } from "./selectors";

import type { ChatCustomerOverview, ChatMessage } from "./schemas";

const lookup = (table: Readonly<Record<string, string>>, key: string) => table[key];

/**
 * Mã trạng thái thô của BE trong thẻ (lô giao `HANDED_OVER`, `DELIVERED`…, hoặc trạng thái đơn) → chữ tiếng Việt của
 * `status-map`; mã lạ → `null` (giữ nguyên chữ BE).
 */
export function chatStatusWord(code: string): string | null {
  const shipment = lookup(PACK_SHIPMENT_STATUS_DISPLAY, code);
  if (shipment) return statusLabelVi(shipment) ?? null;
  const order = lookup(REPORT_ORDER_STATUS_TO_FE, code);
  if (order) return statusLabelVi(order, "order") ?? null;
  return null;
}

/** Thân tin hệ thống kiểu `Đơn SO-…: DELIVERED` (BE `DocumentCards`): đuôi là mã trạng thái IN HOA. */
const RAW_STATUS_TAIL = /^(.*):\s*([A-Z][A-Z_]+)$/;

/**
 * Câu xem trước của tin cuối trong hộp thư. Thẻ trạng thái đơn đọc số đơn + trạng thái từ `payload`; thẻ khác mà thân tin
 * kết thúc bằng mã trạng thái thì thay mã bằng chữ. Tin thường giữ nguyên.
 */
export function messagePreview(message: Pick<ChatMessage, "body" | "card">): string | null {
  const card = message.card;
  if (card?.kind === "ORDER_STATUS") {
    const number = payloadText(card, "orderNumber");
    const status = payloadText(card, "status");
    const word = status ? chatStatusWord(status) : null;
    if (number && word) return CHAT_INBOX_LABELS.orderStatus(number, word);
  }
  const body = message.body ?? null;
  if (!card || !body) return body;
  const match = RAW_STATUS_TAIL.exec(body);
  const word = match?.[2] ? chatStatusWord(match[2]) : null;
  return match && word ? `${match[1]}: ${word}` : body;
}

/**
 * Giờ của tin cuối, ngắn và không xuống dòng: hôm nay → `HH:mm`; trong năm → `dd/MM`; năm khác → `dd/MM/yyyy` (giờ Việt
 * Nam). Bản đầy đủ đặt ở `title`.
 */
export function inboxTime(iso: string, now: Date = new Date()): string {
  const full = formatDateTime(iso); // dd/MM/yyyy HH:mm
  const day = toLocalIsoDate(iso);
  const today = toLocalIsoDate(now.toISOString());
  if (day === today) return full.slice(11);
  if (day.slice(0, 4) === today.slice(0, 4)) return full.slice(0, 5);
  return full.slice(0, 10);
}

type Document = ChatCustomerOverview["quotes"][number];

/** Báo giá còn chờ và đơn còn chạy của khách, từ hồ sơ khách (S16 — mỗi loại tối đa 10 chứng từ gần nhất). */
export function openDocuments(overview: ChatCustomerOverview | undefined): {
  quotes: Document[];
  orders: Document[];
} {
  if (!overview) return { quotes: [], orders: [] };
  return {
    quotes: overview.quotes.filter(
      (q) => !!q.status && CHAT_OPEN_QUOTE_STATUSES.includes(q.status),
    ),
    orders: overview.orders.filter(
      (o) => !!o.status && !CHAT_CLOSED_ORDER_STATUSES.includes(o.status),
    ),
  };
}
