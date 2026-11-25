"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { formatDateTime } from "@/lib/format/date";
import { lastChangeRequest } from "@/features/quote/selectors";
import { Notice } from "@/components/shared/Notice";

import { MONO } from "../copy";

import type { Quote } from "@/features/quote/types";

/**
 * Bản nháp sửa: BE xoá `customerFeedback` khi mở bản sửa, ý khách chỉ còn ở dòng lịch sử CHANGES_REQUESTED cuối.
 * Dùng chung cho trang chi tiết và đầu form sửa.
 */
export function ChangeRequestNotice({ history }: { history: Quote["history"] }) {
  const request = lastChangeRequest(history);
  if (!request) return null;
  return (
    <Notice tone="warning">
      <strong>
        Khách yêu cầu sửa (bản {request.revision}, {formatDateTime(request.at)}):
      </strong>{" "}
      <span className="whitespace-pre-line">{request.feedback ?? "Không ghi nội dung."}</span>
      <span className="text-ink-secondary mt-1 block text-[0.8125rem]">
        Khách vẫn thấy bản {request.revision} và yêu cầu này cho tới khi bạn gửi bản sửa.
      </span>
    </Notice>
  );
}

/** Phản hồi của khách, lý do huỷ, đơn đã tạo, báo giá cũ — đọc nguyên từ BE. */
export function QuoteNotices({ quote }: { quote: Quote }) {
  return (
    <>
      {quote.legacy && (
        <Notice tone="info">
          {quote.status === "ACCEPTED"
            ? "Báo giá cũ trước khi chuyển sang báo giá theo thùng — không tạo đơn được. Khách vẫn muốn mua: huỷ báo giá này rồi lập báo giá mới."
            : "Báo giá cũ trước khi chuyển sang báo giá theo thùng — chỉ xem."}
        </Notice>
      )}
      {quote.status === "CHANGES_REQUESTED" && quote.customerFeedback && (
        <Notice tone="warning">
          <strong>Khách yêu cầu sửa:</strong>{" "}
          <span className="whitespace-pre-line">{quote.customerFeedback}</span>
        </Notice>
      )}
      {quote.status === "DRAFT" && <ChangeRequestNotice history={quote.history} />}
      {quote.cancellationReason && (
        <Notice tone="danger">
          <strong>Lý do huỷ:</strong> {quote.cancellationReason}
        </Notice>
      )}
      {quote.convertedOrder && (
        <Notice tone="positive">
          Đã tạo đơn <span className={MONO}>{quote.convertedOrder.orderNumber}</span> —{" "}
          <span className={MONO}>{formatMoney(quote.convertedOrder.total, "VND")}</span>.{" "}
          <Link
            href={ADMIN_ROUTES.orders.detail(quote.convertedOrder.orderId)}
            className="text-accent-text hover:underline"
          >
            Mở đơn
          </Link>
        </Notice>
      )}
    </>
  );
}
