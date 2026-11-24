"use client";

import { useCancelQuote } from "@/features/quote/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Quote } from "@/features/quote/types";

/**
 * Huỷ báo giá — lý do bắt buộc (BE `QuoteRequests.Cancellation`, 1–500 ký tự). Nháp: BE không trả nháp có lập từ yêu cầu
 * báo giá hay không, nên câu cảnh báo đóng yêu cầu luôn hiện, viết có điều kiện (LC-3).
 */
export function CancelQuoteDialog({
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
  const cancel = useCancelQuote();
  const accepted = quote.status === "ACCEPTED";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={accepted ? "Huỷ báo giá đã chấp nhận?" : "Huỷ báo giá nháp?"}
      description={
        accepted
          ? "Chỉ huỷ được khi có SKU trên báo giá đã ngừng bán hoặc khách không còn hoạt động (hệ thống kiểm lại). Ghi lý do; lập báo giá mới nếu khách vẫn muốn mua."
          : "Báo giá bị huỷ không thể khôi phục. Nếu nháp này lập từ yêu cầu báo giá của khách, huỷ sẽ đóng yêu cầu đó. Chỉ sai giá hay số thùng thì sửa nháp thay vì huỷ."
      }
      confirmLabel="Huỷ báo giá"
      requireReason
      reasonLabel="Lý do huỷ"
      reasonMaxLength={500}
      loading={cancel.isPending}
      closeOnConfirm={false}
      onConfirm={(reason) =>
        cancel.mutate(
          { id: quote.id, version: quote.version, reason: reason ?? "" },
          { onSuccess: onClose, onError },
        )
      }
    />
  );
}
