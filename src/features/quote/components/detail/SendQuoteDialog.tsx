"use client";

import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { QUOTE_PRICE_MISSING_CODES, isQuoteErrorCode } from "@/features/quote/errors";
import { useSendQuote } from "@/features/quote/mutations";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Quote } from "@/features/quote/types";

/**
 * Xác nhận gửi báo giá cho khách (gửi kèm `version`); BE từ chối vì thiếu phí khuôn / giá → về form sửa để nhập.
 * 14 BR-10: kiểm tra giá của nháp (`priceCheck.needsApproval`) nói trước khi gửi rằng báo giá sẽ chuyển Quản lý kinh doanh
 * duyệt giá thay vì đến khách; BE quyết định lại lúc gửi và câu báo sau khi gửi đọc theo response (`useSendQuote`).
 */
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
  // Tổng BE đã tính cho bản nháp: Sale thấy con số khách sẽ thấy trước khi gửi.
  const total = quote.proposed?.total ?? quote.proposedTotal ?? null;
  const totalText = total != null ? `Tổng có thuế ${formatMoney(total, "VND")}. ` : "";
  const approval = quote.priceCheck?.needsApproval ?? false;
  const R = QUOTE_PRICE_REVIEW_LABELS.sendDialog;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={approval ? R.approvalTitle : "Gửi báo giá cho khách?"}
      description={
        approval
          ? `${totalText}${R.approvalDescription}`
          : `${totalText}Khách thấy báo giá trong chat / trang báo giá và có thể chấp nhận hoặc yêu cầu sửa. Sau khi gửi không sửa được nội dung.`
      }
      confirmLabel={approval ? R.approvalConfirm : "Gửi khách"}
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
    >
      {/* S03-1: gửi cho ai và hiệu lực đến ngày nào — Sale kiểm lại ngay trong hộp xác nhận. */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-ink-secondary">Gửi cho</dt>
        <dd className="text-ink-primary">
          <CustomerName id={quote.customerId} link={false} />
        </dd>
        <dt className="text-ink-secondary">Hiệu lực đến hết ngày</dt>
        <dd className="text-ink-primary tabular-nums">{formatDate(quote.validUntil)}</dd>
      </dl>
    </ConfirmDialog>
  );
}
