"use client";

import { ADMIN_ROUTES, CUSTOMER_FALLBACK_LABEL } from "@/constants";

import { CreditLimitLink } from "./CreditLimitLink";

import type { CreditHold } from "../../types";

/** Ô khách của hàng đợi công nợ: tên, mã và lối tắt sửa hạn mức (AUTH-6, chỉ người duyệt công nợ thấy). */
export function CustomerCell({ row }: { row: CreditHold }) {
  return (
    <div className="flex flex-col items-start">
      {/* Không có tên → nhãn trung tính, không hiện mảnh UUID (BO-UX-6) */}
      <span className="text-ink-primary text-[0.8125rem]">
        {row.order.customerName || row.order.recipientName || CUSTOMER_FALLBACK_LABEL}
      </span>
      {row.order.customerCode && (
        <span className="text-ink-tertiary max-w-40 truncate font-[family-name:var(--font-mono)] text-xs">
          {row.order.customerCode}
        </span>
      )}
      <CreditLimitLink
        customerId={row.order.customerId}
        returnTo={ADMIN_ROUTES.orders.creditHolds}
      />
    </div>
  );
}
