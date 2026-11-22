"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, MoreHorizontal } from "lucide-react";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useOpenChat, useStartQuote } from "../mutations";
import { primaryQuoteRequestAction, quoteRequestActions, quoteRequestName } from "../lifecycle";

import type { QuoteRequestAction } from "../lifecycle";
import type { QuoteRequest } from "../types";

/** Phần của mutation đóng mà ô hành động cần; mỗi danh sách tự giữ hook đóng của loại yêu cầu mình. */
export interface CloseRequestMutation {
  mutate: (id: string, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
  isError: boolean;
  /** The request id of the last call: one hook serves every row, so a row reads only its own state. */
  variables?: string;
  reset: () => void;
}

/**
 * Ô "Hành động" (BO-UX-10/11, L-2): MỘT nút chính — "Lập báo giá", hoặc "Mở chat" khi chưa lập được (lý do ở icon
 * thông tin cạnh nút) — và các thao tác còn lại ("Đóng", "Lập báo giá" đang tắt kèm lý do) trong menu `…`, để dòng
 * chỉ cao một hàng và nút chính thấy được ở 1366px. Tên truy cập của mọi nút kèm tên thiết kế / dự án của dòng: mười
 * dòng không còn là mười nút "Lập báo giá" giống hệt nhau với trình đọc màn hình. Nút nào hiện, nút nào tắt do
 * `quoteRequestActions` quyết.
 */
export function QuoteRequestActions({
  row,
  close,
}: {
  row: QuoteRequest;
  close: CloseRequestMutation;
}) {
  const router = useRouter();
  const can = usePermissionChecker();
  const [confirming, setConfirming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (href: string) => router.push(href);
  const openChat = useOpenChat(navigate);
  const startQuote = useStartQuote(navigate);
  const actions = quoteRequestActions(row, can);
  const primary = primaryQuoteRequestAction(actions);
  const rest = actions.filter((action) => action !== primary);
  const name = quoteRequestName(row);
  // One close hook for the whole list: only this row's close locks this row.
  const closingThis = close.isPending && close.variables === row.id;
  // "Lập báo giá" đang tắt nằm trong menu: lý do của nó hiện cạnh nút chính.
  const blockedHint = actions.find(
    (action) => action.id === "create-quote" && !action.enabled,
  )?.hint;

  const busy = (action: QuoteRequestAction) =>
    (action.id === "open-chat" && openChat.isPending) ||
    (action.id === "create-quote" && startQuote.isPending) ||
    (action.id === "close" && closingThis);

  const run = (id: QuoteRequestAction["id"]) => {
    setMenuOpen(false);
    if (id === "open-chat") openChat.mutate(row);
    else if (id === "create-quote") startQuote.mutate(row);
    else {
      close.reset();
      setConfirming(true);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {blockedHint && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${COPY.createQuote} chưa được — ${name}: ${blockedHint}`}
                className="text-ink-tertiary hover:text-ink-primary rounded-[var(--r-sm)] p-0.5"
              >
                <Info className="text-dot-warning size-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{blockedHint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {primary && (
        <Button
          type="button"
          size="sm"
          variant={primary.id === "create-quote" ? "default" : "outline"}
          aria-label={`${primary.label} — ${name}`}
          disabled={!primary.enabled || busy(primary)}
          onClick={() => run(primary.id)}
        >
          {primary.label}
        </Button>
      )}
      {rest.length > 0 && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`${COPY.moreActions} — ${name}`}
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-60 flex-col gap-0.5 p-1">
            {rest.map((action) => (
              <button
                key={action.id}
                type="button"
                aria-label={`${action.label} — ${name}`}
                disabled={!action.enabled || busy(action)}
                onClick={() => run(action.id)}
                className="hover:bg-bg-muted text-ink-primary flex flex-col items-start rounded-[var(--r-sm)] px-2.5 py-1.5 text-left text-[0.8125rem] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{action.label}</span>
                {action.hint && <span className="text-ink-tertiary text-xs">{action.hint}</span>}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={COPY.closeTitle}
        description={COPY.closeDescription}
        confirmLabel={COPY.close}
        variant="default"
        closeOnConfirm={false}
        loading={closingThis}
        error={
          close.isError && close.variables === row.id
            ? "Không đóng được yêu cầu. Thử lại."
            : undefined
        }
        onConfirm={() => close.mutate(row.id, { onSuccess: () => setConfirming(false) })}
      />
    </div>
  );
}
