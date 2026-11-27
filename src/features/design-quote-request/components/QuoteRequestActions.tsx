"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Eye, FileText, MessageSquare, XCircle } from "lucide-react";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useOpenChat, useStartQuote } from "../mutations";
import { quoteRequestActions, quoteRequestName } from "../lifecycle";

import type { LucideIcon } from "lucide-react";
import type { QuoteRequestAction } from "../lifecycle";
import type { CloseRequestInput } from "../mutations";
import type { QuoteRequest } from "../types";

/** Phần của mutation đóng mà ô hành động cần; mỗi danh sách tự giữ hook đóng của loại yêu cầu mình. */
export interface CloseRequestMutation {
  mutate: (input: CloseRequestInput, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
  isError: boolean;
  /** The last call: one hook serves every row, so a row reads only its own state. */
  variables?: CloseRequestInput;
  reset: () => void;
}

/** Icon đứng trước chữ của từng thao tác trong menu "⋯". */
const ACTION_ICON: Record<QuoteRequestAction["id"], LucideIcon> = {
  "create-quote": FileText,
  "open-chat": MessageSquare,
  close: XCircle,
};

/** BE `DesignProjectQuoteRequestService.MAX_CLOSE_REASON`. */
const CLOSE_REASON_MAX = 1000;

/** Nút chính "Lập báo giá" — nền brand, cỡ nhỏ trên dòng bảng, cỡ thường trên header trang chi tiết. */
const PRIMARY_CLASS =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse gap-1.5 whitespace-nowrap";

/**
 * Ô "Thao tác" (backoffice-erp-ui A6) và nút của header trang chi tiết: "Lập báo giá" là việc chính của hộp yêu cầu nên
 * hiện thành nút riêng khi lập được (rà UI WF-02 bo-02 — không giấu trong "⋯"); "Mở chat", "Đóng" (cuối, chữ đỏ) và
 * "Lập báo giá" khi đang tắt (kèm lý do ở dòng phụ) nằm trong menu "⋯". Tên truy cập của các nút kèm tên thiết kế / dự
 * án của dòng. Nút nào hiện, nút nào tắt do `quoteRequestActions` quyết.
 */
export function QuoteRequestActions({
  row,
  close,
  viewHref,
  placement = "row",
}: {
  row: QuoteRequest;
  close: CloseRequestMutation;
  /** Có → mục đầu "Xem chi tiết" dẫn tới trang chi tiết của yêu cầu dự án. */
  viewHref?: string;
  /** `header` = header trang chi tiết (nút cỡ thường). */
  placement?: "row" | "header";
}) {
  const router = useRouter();
  const can = usePermissionChecker();
  const [confirming, setConfirming] = useState(false);
  // A project request is closed with a reason the customer reads (BE #451); a design's request is not.
  const needsReason = "lines" in row;
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const trimmed = reason.trim();
  const reasonValid = trimmed.length > 0 && trimmed.length <= CLOSE_REASON_MAX;
  const navigate = (href: string) => router.push(href);
  const openChat = useOpenChat(navigate);
  const startQuote = useStartQuote(navigate);
  const actions = quoteRequestActions(row, can);
  const name = quoteRequestName(row);
  // One close hook for the whole list: only this row's close locks this row.
  const closingThis = close.isPending && close.variables?.id === row.id;
  const primary = actions.find((action) => action.id === "create-quote" && action.enabled);
  const menuActions = actions.filter((action) => action !== primary);

  const busy = (action: QuoteRequestAction) =>
    (action.id === "open-chat" && openChat.isPending) ||
    (action.id === "create-quote" && startQuote.isPending) ||
    (action.id === "close" && closingThis);

  const run = (id: QuoteRequestAction["id"]) => {
    if (id === "open-chat") openChat.mutate(row);
    else if (id === "create-quote") startQuote.mutate(row);
    else {
      close.reset();
      setReason("");
      setReasonTouched(false);
      setConfirming(true);
    }
  };

  return (
    <div
      className={`flex items-center gap-1 ${placement === "row" ? "justify-end" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {primary && (
        <Button
          type="button"
          size={placement === "row" ? "xs" : "sm"}
          aria-label={`${primary.label} — ${name}`}
          disabled={busy(primary)}
          onClick={() => run(primary.id)}
          className={PRIMARY_CLASS}
        >
          <FileText className="size-3.5" aria-hidden="true" />
          {primary.label}
        </Button>
      )}
      <RowActionsMenu
        label={`${COPY.moreActions} — ${name}`}
        actions={[
          ...(viewHref ? [{ label: COPY.viewDetail, icon: Eye, href: viewHref }] : []),
          ...menuActions.map((action) => ({
            label: action.label,
            icon: ACTION_ICON[action.id],
            hint: action.hint,
            disabled: !action.enabled || busy(action),
            danger: action.id === "close",
            onSelect: () => run(action.id),
          })),
        ]}
      >
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={COPY.closeTitle}
          description={needsReason ? COPY.closeProjectDescription : COPY.closeDescription}
          confirmLabel={COPY.close}
          variant="default"
          closeOnConfirm={false}
          loading={closingThis}
          error={
            close.isError && close.variables?.id === row.id
              ? "Không đóng được yêu cầu. Thử lại."
              : undefined
          }
          onConfirm={() => {
            if (needsReason && !reasonValid) {
              setReasonTouched(true);
              return;
            }
            close.mutate(needsReason ? { id: row.id, reason: trimmed } : { id: row.id }, {
              onSuccess: () => setConfirming(false),
            });
          }}
        >
          {needsReason && (
            <div className="space-y-1.5">
              <Label htmlFor={`close-reason-${row.id}`}>{COPY.closeReasonLabel}</Label>
              <Textarea
                id={`close-reason-${row.id}`}
                value={reason}
                maxLength={CLOSE_REASON_MAX}
                rows={3}
                placeholder={COPY.closeReasonPlaceholder}
                aria-invalid={reasonTouched && !reasonValid ? true : undefined}
                aria-describedby={
                  reasonTouched && !reasonValid ? `close-reason-${row.id}-error` : undefined
                }
                onChange={(event) => setReason(event.target.value)}
                onBlur={() => setReasonTouched(true)}
              />
              {reasonTouched && !reasonValid && (
                <p id={`close-reason-${row.id}-error`} role="alert" className="text-danger text-xs">
                  {COPY.closeReasonRequired}
                </p>
              )}
            </div>
          )}
        </ConfirmDialog>
      </RowActionsMenu>
    </div>
  );
}
