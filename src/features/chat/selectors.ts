/** Chat — selector thuần: đọc payload thẻ (JSON tự do) thành giá trị đã narrow. */

import { QUOTE_STATUS_LABELS, SALES_CONTRACT_STATUS_LABELS } from "@/constants";
import { REPORT_ORDER_STATUS_TO_FE } from "@/constants/reporting";
import { statusLabelVi } from "@/lib/status-map";

import type { ChatAttachableContext } from "@/constants";
import type { ChatCard, ChatCustomerOverview, ChatMessage } from "./schemas";

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

/**
 * Vì sao thẻ yêu cầu báo giá chưa lập báo giá được (không có `CREATE_QUOTE`): câu một dòng theo trạng thái thiết kế,
 * `null` khi không có lý do liên quan tới thiết kế. Bản trả lại (DRAFT) và đã xoá (ARCHIVED) không phải "chờ duyệt".
 */
export function designWaitNote(view: QuoteRequestView): string | null {
  if (view.scope === "PROJECT") {
    return view.lines.some((line) => line.designStatus !== "APPROVED")
      ? "Chờ duyệt thiết kế"
      : null;
  }
  if (view.designStatus === null || view.designStatus === "APPROVED") return null;
  if (view.designStatus === "ARCHIVED") return "Thiết kế đã bị xoá";
  if (view.designStatus === "DRAFT") return "Khách đang sửa thiết kế";
  return "Chờ duyệt thiết kế";
}

export const DESIGN_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Bị trả lại / nháp",
  PENDING_REVIEW: "Chờ duyệt thiết kế",
  APPROVED: "Đã duyệt",
  ARCHIVED: "Đã lưu trữ",
};

const PROJECT_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Đang mở",
  ARCHIVED: "Đã đóng",
};

/**
 * Trạng thái của một chứng từ ngữ cảnh (`ConversationContext.status`, mã BE thô như `APPROVED`, `DRAFT`) → nhãn tiếng
 * Việt theo loại chứng từ (WF-02 audit: chip từng hiện thô). Mã lạ giữ nguyên.
 */
export function contextStatusLabel(kind: string, status: string): string {
  const byKind: Readonly<Record<string, string>> | undefined =
    kind === "DESIGN"
      ? DESIGN_STATUS_LABELS
      : kind === "DESIGN_PROJECT"
        ? PROJECT_STATUS_LABELS
        : kind === "QUOTE"
          ? QUOTE_STATUS_LABELS
          : kind === "CONTRACT"
            ? SALES_CONTRACT_STATUS_LABELS
            : undefined;
  if (byKind?.[status]) return byKind[status];
  if (kind === "ORDER") {
    const fe = (REPORT_ORDER_STATUS_TO_FE as Readonly<Record<string, string>>)[status];
    if (fe) return statusLabelVi(fe, "order") ?? fe;
  }
  return statusLabelVi(status) ?? status;
}

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

/** Trang tin mới nhất (poll) + các trang cũ đã tải: khử trùng theo `seq`, sắp theo thời gian. */
export function mergeMessages(
  latest: readonly ChatMessage[],
  olderPages: readonly (readonly ChatMessage[])[],
): ChatMessage[] {
  const bySeq = new Map<number, ChatMessage>();
  for (const page of olderPages) for (const message of page) bySeq.set(message.seq, message);
  // Trang mới nhất thắng khi trùng: nó được tải lại liên tục nên tin sửa / xoá luôn mới hơn.
  for (const message of latest) bySeq.set(message.seq, message);
  return chronological([...bySeq.values()]);
}

/** Có chỗ hở giữa hai `seq` liền nhau (seq của hội thoại liên tục) → thiếu tin giữa trang cũ và trang mới nhất. */
export function hasMessageGap(messages: readonly Pick<ChatMessage, "seq">[]): boolean {
  return messages.some((message, i) => i > 0 && message.seq - (messages[i - 1]?.seq ?? 0) > 1);
}

/** Cách đáy dưới ngưỡng này (px) vẫn coi là đang ở cuối — tin mới tự kéo xuống. */
export const STICK_TO_BOTTOM_THRESHOLD = 48;

export function shouldStickToBottom(box: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight < STICK_TO_BOTTOM_THRESHOLD;
}

export interface AttachableDocument {
  id: string;
  label: string;
}

/**
 * Chứng từ của khách theo loại, đọc từ hồ sơ (S16) để gắn vào hội thoại (S13): số chứng từ (hoặc tên bản thiết
 * kế) kèm trạng thái. Không có hồ sơ = danh sách rỗng.
 */
export function attachableDocuments(
  overview: ChatCustomerOverview | undefined,
  kind: ChatAttachableContext,
): AttachableDocument[] {
  if (!overview) return [];
  const withStatus = (name: string, status: string | null | undefined) =>
    status ? `${name} · ${status}` : name;
  if (kind === "DESIGN") {
    return overview.designs.map((design) => ({
      id: design.id,
      label: withStatus(design.name ?? design.id, design.status),
    }));
  }
  const list = {
    QUOTE: overview.quotes,
    ORDER: overview.orders,
    CONTRACT: overview.contracts,
    PRODUCTION_ORDER: overview.productionOrders,
  }[kind];
  return list.map((document) => ({
    id: document.id,
    label: withStatus(document.number ?? document.id, document.status),
  }));
}

/** 16 BR-07: ghi chú nội bộ (visibility STAFF) — vẽ nền vàng, ghi rõ "Khách không thấy". */
export function isInternalNote(message: Pick<ChatMessage, "kind" | "visibility">): boolean {
  return message.kind === "INTERNAL_NOTE" || message.visibility === "STAFF";
}
