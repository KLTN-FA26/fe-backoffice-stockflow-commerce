"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Send } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import {
  QUOTE_PRICE_MISSING_CODES,
  isQuoteErrorCode,
  quoteErrorMessage,
} from "@/features/quote/errors";
import { allowedStaffQuoteActions } from "@/features/quote/lifecycle";
import { useReviseQuote, useSendQuote } from "@/features/quote/mutations";
import { sendBlockReason } from "@/features/quote/selectors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { CancelQuoteDialog } from "./CancelQuoteDialog";
import { ConvertQuoteDialog } from "./ConvertQuoteDialog";
import { QuotePdfButton } from "./QuotePdfButton";

import type { Quote } from "@/features/quote/types";

type Dialog = "send" | "cancel" | "revise" | "convert" | null;

/**
 * Nút back-office theo lifecycle (allowedStaffQuoteActions, plan WF-02 A4):
 * DRAFT → Sửa / Gửi khách / Huỷ; CHANGES_REQUESTED → Mở bản sửa; ACCEPTED → Tạo đơn (Huỷ chỉ khi BE cho).
 * Tải PDF luôn có cho người đọc được báo giá.
 */
export function QuoteStaffActions({ quote }: { quote: Quote }) {
  const can = usePermissionChecker();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const send = useSendQuote();
  const revise = useReviseQuote();
  const actions = allowedStaffQuoteActions(quote.status, can, quote.legacy);
  const onError = (error: unknown) => toast.error(quoteErrorMessage(error));
  const close = () => setDialog(null);
  const sendBlocked = sendBlockReason(quote);
  const onSendError = (error: unknown) => {
    onError(error);
    // Thiếu phí khuôn / giá → về form sửa để nhập (plan §4).
    if (isQuoteErrorCode(error, QUOTE_PRICE_MISSING_CODES))
      router.push(ADMIN_ROUTES.quotes.edit(quote.id));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuotePdfButton quote={quote} onError={onError} />
      {actions.includes("cancel") && (
        <Button
          size="sm"
          variant="outline"
          className="text-danger"
          onClick={() => setDialog("cancel")}
        >
          {quote.status === "ACCEPTED" ? "Huỷ (SKU ngừng bán)" : "Huỷ báo giá"}
        </Button>
      )}
      {actions.includes("edit") && (
        <Button asChild size="sm" variant="outline">
          <Link href={ADMIN_ROUTES.quotes.edit(quote.id)}>
            <Pencil className="size-3.5" /> Sửa
          </Link>
        </Button>
      )}
      {actions.includes("send") && (
        <Button
          size="sm"
          disabled={!!sendBlocked}
          title={sendBlocked ?? undefined}
          onClick={() => setDialog("send")}
        >
          <Send className="size-3.5" /> Gửi khách
        </Button>
      )}
      {actions.includes("revise") && (
        <Button size="sm" disabled={revise.isPending} onClick={() => setDialog("revise")}>
          {revise.isPending && <LoaderCircle className="size-3.5 animate-spin" />} Mở bản sửa
        </Button>
      )}
      {actions.includes("convert") && (
        <Button size="sm" onClick={() => setDialog("convert")}>
          Tạo đơn
        </Button>
      )}
      {sendBlocked && actions.includes("send") && (
        <span className="text-ink-tertiary text-xs">{sendBlocked}</span>
      )}

      <ConfirmDialog
        open={dialog === "send"}
        onOpenChange={(open) => !open && close()}
        title="Gửi báo giá cho khách?"
        description="Khách thấy báo giá trong chat / trang báo giá và có thể chấp nhận hoặc yêu cầu sửa. Sau khi gửi không sửa được nội dung."
        confirmLabel="Gửi khách"
        variant="default"
        loading={send.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          send.mutate(
            { id: quote.id, version: quote.version },
            {
              onSuccess: close,
              onError: (error) => {
                close();
                onSendError(error);
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={dialog === "revise"}
        onOpenChange={(open) => !open && close()}
        title="Mở bản sửa?"
        description="Báo giá trở về nháp (bản mới) để Sales điều chỉnh theo góp ý của khách, rồi gửi lại."
        confirmLabel="Mở bản sửa"
        variant="default"
        loading={revise.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          revise.mutate({ id: quote.id, version: quote.version }, { onSuccess: close, onError })
        }
      />
      <CancelQuoteDialog
        quote={quote}
        open={dialog === "cancel"}
        onClose={close}
        onError={onError}
      />
      <ConvertQuoteDialog
        quote={quote}
        open={dialog === "convert"}
        onOpenChange={(open) => !open && close()}
      />
    </div>
  );
}
