"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { Notice } from "@/components/shared/Notice";

import { MONO } from "../copy";

import type { Quote } from "@/features/quote/types";

/** Phản hồi của khách, lý do huỷ, đơn đã tạo, báo giá cũ — đọc nguyên từ BE. */
export function QuoteNotices({ quote }: { quote: Quote }) {
  return (
    <>
      {quote.legacy && (
        <Notice tone="info">Báo giá cũ trước khi chuyển sang báo giá theo thùng — chỉ xem.</Notice>
      )}
      {quote.status === "CHANGES_REQUESTED" && quote.customerFeedback && (
        <Notice tone="warning">
          <strong>Khách yêu cầu sửa:</strong>{" "}
          <span className="whitespace-pre-line">{quote.customerFeedback}</span>
        </Notice>
      )}
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
            className="text-accent hover:underline"
          >
            Mở đơn
          </Link>
        </Notice>
      )}
    </>
  );
}
