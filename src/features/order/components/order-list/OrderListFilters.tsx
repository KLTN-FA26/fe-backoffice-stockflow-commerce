"use client";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { DatePicker } from "@/components/shared/DatePicker";
import { Label } from "@/components/ui/label";

import { FILTER_LABELS } from "./constants";

import type { OrderListState } from "./useOrderListState";

const FIELD = "flex flex-col gap-1";
const LABEL = "text-ink-secondary text-xs font-medium";
const CONTROL = "border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Hàng bộ lọc riêng của đơn: khách hàng, khoảng ngày đặt (URL qua nuqs) — đúng các tham số BE
 * `GET /orders` nhận; không lọc theo phương thức thanh toán (BE chưa hỗ trợ).
 * Khách chọn theo tên / MST (`CustomerPicker` chế độ lọc, R3 WF4 UX audit — không bắt gõ UUID); BE vẫn nhận UUID
 * trên URL. `GET /customers` của BE chặn ORDER_COORDINATOR / ACCOUNTANT (403) → vai trò không có
 * `customer-customers:READ` không thấy ô này, vẫn lọc nhanh được bằng nút ở cột Khách hàng (chip ở thanh Cấu hình
 * có nút bỏ lọc).
 */
export function OrderListFilters({ s }: { s: OrderListState }) {
  const { extra } = s;
  const canPickCustomer = useCan(CUSTOMER_PERMISSIONS.read);

  return (
    <div className="border-border-default bg-bg-subtle mb-2 flex flex-col gap-2 rounded-[var(--r-sm)] border px-3 py-2">
      <div className="flex flex-wrap items-end gap-3">
        {canPickCustomer && (
          <CustomerPicker
            idPrefix="order-filter"
            mode="filter"
            value={extra.customerId}
            onChange={extra.setCustomerId}
          />
        )}
        <div className={FIELD}>
          <Label htmlFor="order-filter-from" className={LABEL}>
            {FILTER_LABELS.from}
          </Label>
          {/* dd/MM/yyyy dùng chung (B1): ô `type="date"` theo locale trình duyệt đọc 03/12 thành 12/3 */}
          <DatePicker
            id="order-filter-from"
            value={extra.placedFrom}
            max={extra.placedTo || undefined}
            onChange={extra.setPlacedFrom}
            clearable
            aria-invalid={extra.invalidRange || undefined}
            className={`${CONTROL} w-40 tabular-nums`}
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="order-filter-to" className={LABEL}>
            {FILTER_LABELS.to}
          </Label>
          <DatePicker
            id="order-filter-to"
            value={extra.placedTo}
            min={extra.placedFrom || undefined}
            onChange={extra.setPlacedTo}
            clearable
            aria-invalid={extra.invalidRange || undefined}
            aria-describedby={extra.invalidRange ? "order-filter-range-error" : undefined}
            className={`${CONTROL} w-40 tabular-nums`}
          />
        </div>
      </div>
      {extra.invalidRange && (
        <p id="order-filter-range-error" role="alert" className="text-danger text-xs">
          {FILTER_LABELS.invalidRange}
        </p>
      )}
    </div>
  );
}
