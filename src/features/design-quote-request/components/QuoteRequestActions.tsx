"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { useOpenChat, useStartQuote } from "../mutations";
import { quoteRequestActions } from "../lifecycle";

import type { QuoteRequest } from "../types";

/** Phần của mutation đóng mà ô hành động cần; mỗi danh sách tự giữ hook đóng của loại yêu cầu mình. */
export interface CloseRequestMutation {
  mutate: (id: string, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
  isError: boolean;
  reset: () => void;
}

/** Ô "Hành động": Mở chat / Lập báo giá / Đóng — nút nào hiện, nút nào tắt do `quoteRequestActions` quyết. */
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
  const navigate = (href: string) => router.push(href);
  const openChat = useOpenChat(navigate);
  const startQuote = useStartQuote(navigate);
  const actions = quoteRequestActions(row, can);

  const run = (id: string) => {
    if (id === "open-chat") openChat.mutate(row);
    else if (id === "create-quote") startQuote.mutate(row);
    else {
      close.reset();
      setConfirming(true);
    }
  };

  return (
    <div className="flex min-w-[10rem] flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant={action.id === "create-quote" ? "default" : "outline"}
            disabled={
              !action.enabled ||
              (action.id === "open-chat" && openChat.isPending) ||
              (action.id === "create-quote" && startQuote.isPending)
            }
            onClick={() => run(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {actions.map((action) =>
        action.hint ? (
          <span key={action.id} className="text-ink-tertiary text-xs">
            {action.hint}
          </span>
        ) : null,
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={COPY.closeTitle}
        description={COPY.closeDescription}
        confirmLabel={COPY.close}
        variant="default"
        closeOnConfirm={false}
        loading={close.isPending}
        error={close.isError ? "Không đóng được yêu cầu. Thử lại." : undefined}
        onConfirm={() => close.mutate(row.id, { onSuccess: () => setConfirming(false) })}
      />
    </div>
  );
}
