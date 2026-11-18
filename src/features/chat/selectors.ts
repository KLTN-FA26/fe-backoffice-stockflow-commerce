/** Chat — selector thuần: đọc payload thẻ (JSON tự do) thành giá trị đã narrow. */

import type { ChatCard, ChatMessage } from "./schemas";

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" ? value : null);

export interface QuoteRequestView {
  scope: "DESIGN" | "PROJECT";
  title: string | null;
  /** DESIGN: `requestStatus`; PROJECT: `status` (BE đặt tên khác nhau). */
  requestStatus: string | null;
  designStatus: string | null;
  returnReason: string | null;
  cartons: number | null;
  desiredDeliveryDate: string | null;
  quoteId: string | null;
  quoteNumber: string | null;
  lines: { designName: string | null; cartons: number | null; designStatus: string | null }[];
}

export function quoteRequestView(card: ChatCard): QuoteRequestView {
  const p = card.payload ?? {};
  const project = p.scope === "PROJECT";
  const lines = Array.isArray(p.lines) ? (p.lines as Record<string, unknown>[]) : [];
  return {
    scope: project ? "PROJECT" : "DESIGN",
    title: str(project ? p.projectName : p.designName),
    requestStatus: str(project ? p.status : p.requestStatus),
    designStatus: str(p.designStatus),
    returnReason: str(p.returnReason),
    cartons: num(p.cartons),
    desiredDeliveryDate: str(p.desiredDeliveryDate),
    quoteId: str(p.quoteId),
    quoteNumber: str(p.quoteNumber),
    lines: lines.map((line) => ({
      designName: str(line.designName),
      cartons: num(line.cartons),
      designStatus: str(line.designStatus),
    })),
  };
}

/** Thẻ yêu cầu báo giá chờ thiết kế được duyệt (không có `CREATE_QUOTE`). */
export function awaitsDesignApproval(view: QuoteRequestView): boolean {
  if (view.scope === "PROJECT") return view.lines.some((line) => line.designStatus !== "APPROVED");
  return view.designStatus !== null && view.designStatus !== "APPROVED";
}

export const DESIGN_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Bị trả lại / nháp",
  PENDING_REVIEW: "Chờ duyệt thiết kế",
  APPROVED: "Đã duyệt",
  ARCHIVED: "Đã lưu trữ",
};

export function payloadText(card: ChatCard, key: string): string | null {
  return str(card.payload?.[key]);
}

export function payloadNumber(card: ChatCard, key: string): number | null {
  return num(card.payload?.[key]);
}

/** Tin theo thứ tự thời gian (seq tăng dần). */
export function chronological(messages: readonly ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.seq - b.seq);
}

/** 16 BR-07: ghi chú nội bộ (visibility STAFF) — vẽ nền vàng, ghi rõ "Khách không thấy". */
export function isInternalNote(message: Pick<ChatMessage, "kind" | "visibility">): boolean {
  return message.kind === "INTERNAL_NOTE" || message.visibility === "STAFF";
}
