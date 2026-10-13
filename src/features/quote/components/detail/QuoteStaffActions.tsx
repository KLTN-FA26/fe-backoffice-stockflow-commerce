"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, Pencil, Send } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { quoteErrorMessage } from "@/features/quote/errors";
import { allowedStaffQuoteActions } from "@/features/quote/lifecycle";
import { useCancelQuote, useReviseQuote, useSendQuote } from "@/features/quote/mutations";
import { isExpired } from "@/features/quote/selectors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { ConvertQuoteDialog } from "./ConvertQuoteDialog";

import type { Quote } from "@/features/quote/types";

type Dialog = "send" | "cancel" | "revise" | "convert" | null;

/**
 * Nút back-office theo lifecycle (allowedStaffQuoteActions). Nút chính đặt cuối (bên phải):
 * DRAFT → Gửi khách; CHANGES_REQUESTED → Mở bản sửa; ACCEPTED → Tạo đơn bán.
 * Giả định tần suất: Sales thao tác "Gửi" nhiều nhất — cần kiểm chứng với người dùng thật.
 */
export function QuoteStaffActions({ quote }: { quote: Quote }) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<Dialog>(null);
  const send = useSendQuote();
  const cancel = useCancelQuote();
  const revise = useReviseQuote();
  const actions = allowedStaffQuoteActions(quote.status, can);
  const onError = (error: unknown) => toast.error(quoteErrorMessage(error));
  const close = () => setDialog(null);
  // BE từ chối gửi khi còn dòng chưa có giá hoặc hạn hiệu lực đã qua — báo lý do ngay trên nút.
  const sendBlocked = !quote.priced
    ? "Còn dòng chưa có giá"
    : isExpired(quote.validUntil)
      ? "Hạn hiệu lực đã qua — sửa ngày hết hiệu lực"
      : null;

  return (
    <>
      {actions.includes("cancel") && (
        <Button
          size="sm"
          variant="outline"
          className="text-danger"
          onClick={() => setDialog("cancel")}
        >
          Huỷ báo giá
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
          Tạo đơn bán
        </Button>
      )}
      {sendBlocked && actions.includes("send") && (
        <span className="text-ink-tertiary text-xs">{sendBlocked}</span>
      )}

      <ConfirmDialog
        open={dialog === "send"}
        onOpenChange={(open) => !open && close()}
        title="Gửi báo giá cho khách?"
        description="Khách thấy báo giá trên portal và có thể chấp nhận hoặc yêu cầu chỉnh sửa. Sau khi gửi không sửa được nội dung."
        confirmLabel="Gửi khách"
        variant="default"
        loading={send.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          send.mutate({ id: quote.id, version: quote.version }, { onSuccess: close, onError })
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
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && close()}
        title="Huỷ báo giá nháp?"
        description="Báo giá bị huỷ không thể khôi phục. Chỉ báo giá nháp mới huỷ được."
        confirmLabel="Huỷ báo giá"
        requireReason
        reasonLabel="Lý do huỷ"
        reasonMaxLength={500}
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) =>
          cancel.mutate(
            { id: quote.id, version: quote.version, reason: reason ?? "" },
            { onSuccess: close, onError },
          )
        }
      />
      <ConvertQuoteDialog
        quote={quote}
        open={dialog === "convert"}
        onOpenChange={(open) => !open && close()}
      />
    </>
  );
}
