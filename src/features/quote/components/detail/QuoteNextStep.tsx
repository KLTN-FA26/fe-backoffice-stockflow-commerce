"use client";

import Link from "next/link";
import { FilePlus2, MessageSquare } from "lucide-react";

import { ADMIN_ROUTES, CHAT_PERMISSIONS, QUOTE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatDate } from "@/lib/format/date";
import { useQuoteConversationId } from "@/features/quote/queries";
import { isExpired } from "@/features/quote/selectors";
import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import type { Quote } from "@/features/quote/types";

/** Một dòng "việc tiếp theo" theo trạng thái (BO-UX-19): ai đang chờ ai, đến khi nào. */
export function quoteNextStep(quote: Quote): string {
  const expired = quote.status === "SENT" && isExpired(quote.validUntil);
  if (expired) return "Đã quá hạn hiệu lực — khách không chấp nhận được nữa. Lập báo giá mới.";
  switch (quote.status) {
    case "DRAFT":
      return "Bước tiếp theo: nhập đủ giá và phí, rồi Gửi khách.";
    case "SENT":
      return `Chờ khách phản hồi trong chat, đến hết ${formatDate(quote.validUntil)}.`;
    case "CHANGES_REQUESTED":
      return "Khách yêu cầu sửa — Mở bản sửa, điều chỉnh rồi gửi lại.";
    case "ACCEPTED":
      return "Khách đã chấp nhận — Tạo đơn để lập hợp đồng.";
    case "CONVERTED":
      return "Đã tạo đơn — lập hợp đồng ở trang đơn.";
    case "EXPIRED":
      return "Báo giá hết hiệu lực. Lập báo giá mới nếu khách vẫn cần.";
    case "CANCELLED":
      return "Báo giá đã huỷ. Lập báo giá mới nếu khách vẫn cần.";
  }
}

/** Bước tiếp theo + "Mở hội thoại" + "Lập báo giá mới" (EXPIRED / CANCELLED / SENT đã quá hạn) trong thẻ trạng thái. */
export function QuoteNextStep({ quote }: { quote: Quote }) {
  const canChat = useCan(CHAT_PERMISSIONS.read);
  const canCreate = useCan(QUOTE_PERMISSIONS.create);
  const waitsOnCustomer = quote.status === "SENT" || quote.status === "CHANGES_REQUESTED";
  const conversation = useQuoteConversationId(quote, canChat && waitsOnCustomer);
  const ended =
    quote.status === "EXPIRED" ||
    quote.status === "CANCELLED" ||
    (quote.status === "SENT" && isExpired(quote.validUntil));
  return (
    <div className="space-y-2">
      <p className="text-ink-secondary text-center text-xs">{quoteNextStep(quote)}</p>
      {conversation.data && (
        <Button asChild size="sm" variant="outline" className={DETAIL_ACTION_CLASS.outline}>
          <Link href={ADMIN_ROUTES.chat.detail(conversation.data)}>
            <MessageSquare className="size-3.5" aria-hidden="true" /> Mở hội thoại
          </Link>
        </Button>
      )}
      {ended && canCreate && (
        // Chưa có đường tạo báo giá từ dòng của báo giá cũ: mở form cho đúng khách này.
        <Button asChild size="sm" className={DETAIL_ACTION_CLASS.primary}>
          <Link href={ADMIN_ROUTES.quotes.createForCustomer(quote.customerId)}>
            <FilePlus2 className="size-3.5" aria-hidden="true" /> Lập báo giá mới
          </Link>
        </Button>
      )}
    </div>
  );
}
