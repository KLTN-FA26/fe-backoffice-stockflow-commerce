"use client";

import { useState } from "react";

import { ORDER_PAYMENT_TERM_LABELS, ORDER_PAYMENT_TERMS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FILTER_LABELS } from "./constants";

import type { OrderPaymentTerm } from "@/constants";
import type { OrderListState } from "./useOrderListState";

const ALL_TERMS = "ALL";

function isPaymentTerm(value: string): value is OrderPaymentTerm {
  return (ORDER_PAYMENT_TERMS as readonly string[]).includes(value);
}

const FIELD = "flex flex-col gap-1";
const LABEL = "text-ink-secondary text-xs font-medium";
const CONTROL = "border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Hàng bộ lọc riêng của đơn: khách hàng, khoảng ngày đặt, phương thức thanh toán (URL qua nuqs).
 * Mã khách nhập tay: `GET /customers` của BE chặn ORDER_COORDINATOR / ACCOUNTANT (403) nên chưa
 * dựng được ô chọn khách dùng chung cho mọi vai trò.
 */
export function OrderListFilters({ s }: { s: OrderListState }) {
  const { extra } = s;
  // Nháp mã khách — chỉ áp khi Enter / rời ô, tránh gọi API mỗi phím
  const [customerDraft, setCustomerDraft] = useState(extra.customerId);
  const [syncedCustomer, setSyncedCustomer] = useState(extra.customerId);
  if (syncedCustomer !== extra.customerId) {
    // URL đổi từ nơi khác (Reset, back/forward) → đồng bộ lại ô nhập
    setSyncedCustomer(extra.customerId);
    setCustomerDraft(extra.customerId);
  }
  const commitCustomer = () => {
    if (customerDraft.trim() !== extra.customerId) extra.setCustomerId(customerDraft);
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
            placeholder="Nhập mã khách, Enter để lọc"
            className={`${CONTROL} w-64 font-[family-name:var(--font-mono)]`}
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
        <div className={FIELD}>
          <Label htmlFor="order-filter-term" className={LABEL}>
            {FILTER_LABELS.paymentTerm}
          </Label>
          <Select
            value={extra.paymentTerm ?? ALL_TERMS}
            onValueChange={(value) => extra.setPaymentTerm(isPaymentTerm(value) ? value : null)}
          >
            <SelectTrigger id="order-filter-term" className={`${CONTROL} w-48`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TERMS}>{FILTER_LABELS.allTerms}</SelectItem>
              {ORDER_PAYMENT_TERMS.map((term) => (
                <SelectItem key={term} value={term}>
                  {ORDER_PAYMENT_TERM_LABELS[term]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {extra.invalidRange && (
        <p id="order-filter-range-error" role="alert" className="text-danger text-xs">
          {FILTER_LABELS.invalidRange}
        </p>
      )}
      {/* Đã phát hiện BE bỏ qua → cảnh báo mạnh; còn lại chỉ ghi chú (dòng có thể không mang
          paymentTerm nên không phải lúc nào cũng phát hiện được) */}
      {s.paymentTermIgnored ? (
        <Alert tone="warning">{FILTER_LABELS.termIgnored}</Alert>
      ) : (
        extra.paymentTerm && (
          <p className="text-ink-tertiary text-xs">{FILTER_LABELS.termPending}</p>
        )
      )}
    </div>
  );
}
