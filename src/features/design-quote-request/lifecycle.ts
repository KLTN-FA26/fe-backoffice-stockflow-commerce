/**
 * Hành động trên một yêu cầu báo giá — JSX chỉ vẽ mô tả này (feature-architecture "action gating"). Quyền ở client chỉ
 * để ẩn / tắt nút; BE kiểm lại.
 */

import {
  CHAT_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  QUOTE_PERMISSIONS,
} from "@/constants";

import type { DesignStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { QuoteRequest } from "./types";

export type QuoteRequestActionId = "open-chat" | "create-quote" | "close";

export interface QuoteRequestAction {
  id: QuoteRequestActionId;
  label: string;
  enabled: boolean;
  /** Lý do tắt — hiện cạnh nút. */
  hint?: string;
}

const BLOCKED_BY_STATUS: Partial<Record<DesignStatus, string>> = {
  PENDING_REVIEW: COPY.blockedPending,
  DRAFT: COPY.blockedDraft,
  ARCHIVED: COPY.blockedArchived,
};

/** Lý do chưa lập báo giá được, hoặc `null` khi đủ điều kiện (thiết kế đã duyệt, có SKU riêng). */
export function quoteBlocker(row: QuoteRequest): string | null {
  if ("lines" in row) {
    if (row.lines.length === 0) return COPY.blockedEmpty;
    for (const line of row.lines) {
      const blocked = BLOCKED_BY_STATUS[line.designStatus];
      if (blocked) return blocked;
    }
    return row.lines.every((line) => line.customerSku) ? null : COPY.blockedNoSku;
  }
  return BLOCKED_BY_STATUS[row.designStatus] ?? null;
}

export function quoteRequestActions(
  row: QuoteRequest,
  can: (permission: PermissionCode) => boolean,
): QuoteRequestAction[] {
  const actions: QuoteRequestAction[] = [];
  const open = row.status === "OPEN";
  if (can(CHAT_PERMISSIONS.read))
    actions.push({ id: "open-chat", label: COPY.openChat, enabled: true });
  if (open && can(QUOTE_PERMISSIONS.create)) {
    const blocker = quoteBlocker(row);
    actions.push({
      id: "create-quote",
      label: COPY.createQuote,
      enabled: blocker === null,
      hint: blocker ?? undefined,
    });
  }
  if (open && can(DESIGN_QUOTE_REQUEST_PERMISSIONS.update))
    actions.push({ id: "close", label: COPY.close, enabled: true });
  return actions;
}
