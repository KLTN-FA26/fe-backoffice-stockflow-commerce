"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { isValidOrderCustomerId } from "../../schemas";

import { FILTER_LABELS } from "./constants";

import type { OrderListState } from "./useOrderListState";

const FIELD = "flex flex-col gap-1";
const LABEL = "text-ink-secondary text-xs font-medium";
const CONTROL = "border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";
const CUSTOMER_ERROR_ID = "order-filter-customer-error";

/**
 * Hàng bộ lọc riêng của đơn: khách hàng, khoảng ngày đặt (URL qua nuqs) — đúng các tham số BE
 * `GET /orders` nhận; không lọc theo phương thức thanh toán (BE chưa hỗ trợ).
 * ID khách nhập tay: `GET /customers` của BE chặn ORDER_COORDINATOR / ACCOUNTANT (403) nên chưa
 * dựng được ô chọn khách dùng chung cho mọi vai trò. BE nhận UUID — giá trị khác giữ ở ô nhập kèm
 * lỗi inline, không lên URL / không gọi API.
 */
export function OrderListFilters({ s }: { s: OrderListState }) {
  const { extra } = s;
  // Nháp ID khách — chỉ áp khi Enter / rời ô, tránh gọi API mỗi phím
  const [customerDraft, setCustomerDraft] = useState(extra.customerInput);
  const [syncedCustomer, setSyncedCustomer] = useState(extra.customerInput);
  // Báo lỗi sau khi người dùng chốt, hoặc ngay khi URL mang sẵn giá trị sai; sau đó kiểm theo phím
  const [customerTouched, setCustomerTouched] = useState(extra.customerIdInvalid);
  if (syncedCustomer !== extra.customerInput) {
    // URL đổi từ nơi khác (Reset, back/forward, nút lọc ở cột) → đồng bộ lại ô nhập
    setSyncedCustomer(extra.customerInput);
    setCustomerDraft(extra.customerInput);
    setCustomerTouched(extra.customerIdInvalid);
  }
  const customerValue = customerDraft.trim();
  const customerDraftInvalid = customerValue !== "" && !isValidOrderCustomerId(customerValue);
  const customerError = customerTouched && customerDraftInvalid;
  const commitCustomer = () => {
    setCustomerTouched(true);
    // Sai → giữ nháp tại chỗ kèm lỗi, không đụng URL / query
    if (customerDraftInvalid) return;
    if (customerValue !== extra.customerInput) extra.setCustomerId(customerValue);
  };

  return (
    <div className="border-border-default bg-bg-subtle mb-2 flex flex-col gap-2 rounded-[var(--r-sm)] border px-3 py-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className={FIELD}>
          <Label htmlFor="order-filter-customer" className={LABEL}>
            {FILTER_LABELS.customer}
          </Label>
          <Input
            id="order-filter-customer"
            value={customerDraft}
            onChange={(event) => setCustomerDraft(event.target.value)}
            onBlur={commitCustomer}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitCustomer();
            }}
            placeholder={FILTER_LABELS.customerPlaceholder}
            aria-invalid={customerError || undefined}
            aria-describedby={customerError ? CUSTOMER_ERROR_ID : undefined}
            className={`${CONTROL} w-72 font-[family-name:var(--font-mono)]`}
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="order-filter-from" className={LABEL}>
            {FILTER_LABELS.from}
          </Label>
          <Input
            id="order-filter-from"
            type="date"
            value={extra.placedFrom}
            max={extra.placedTo || undefined}
            onChange={(event) => extra.setPlacedFrom(event.target.value)}
            aria-invalid={extra.invalidRange || undefined}
            className={`${CONTROL} w-40 tabular-nums`}
          />
        </div>
        <div className={FIELD}>
          <Label htmlFor="order-filter-to" className={LABEL}>
            {FILTER_LABELS.to}
          </Label>
          <Input
            id="order-filter-to"
            type="date"
            value={extra.placedTo}
            min={extra.placedFrom || undefined}
            onChange={(event) => extra.setPlacedTo(event.target.value)}
            aria-invalid={extra.invalidRange || undefined}
            aria-describedby={extra.invalidRange ? "order-filter-range-error" : undefined}
            className={`${CONTROL} w-40 tabular-nums`}
          />
        </div>
      </div>
      {customerError && (
        <p id={CUSTOMER_ERROR_ID} role="alert" className="text-danger text-xs">
          {FILTER_LABELS.customerInvalid}
        </p>
      )}
      {extra.invalidRange && (
        <p id="order-filter-range-error" role="alert" className="text-danger text-xs">
          {FILTER_LABELS.invalidRange}
        </p>
      )}
    </div>
  );
}
