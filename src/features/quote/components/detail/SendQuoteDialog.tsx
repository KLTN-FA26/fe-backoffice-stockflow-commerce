"use client";

import { useRouter } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";
import { QUOTE_PRICE_MISSING_CODES, isQuoteErrorCode } from "@/features/quote/errors";
import { useSendQuote } from "@/features/quote/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Quote } from "@/features/quote/types";

/** Xác nhận gửi báo giá cho khách (gửi kèm `version`); BE từ chối vì thiếu phí khuôn / giá → về form sửa để nhập. */
export function SendQuoteDialog({
  quote,
  open,
  onClose,
  onError,
}: {
  quote: Quote;
  open: boolean;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const router = useRouter();
  const send = useSendQuote();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
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
            onSuccess: onClose,
            onError: (error) => {
              onClose();
              onError(error);
              // Thiếu phí khuôn / giá → về form sửa để nhập (plan §4).
              if (isQuoteErrorCode(error, QUOTE_PRICE_MISSING_CODES))
                router.push(ADMIN_ROUTES.quotes.edit(quote.id));
            },
          },
        )
      }
    />
  );
}
