"use client";

import { useState } from "react";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { HeaderFilterPopover } from "@/components/shared/ColumnHeaderFilter";
import { Input } from "@/components/ui/input";

import { isValidOrderCustomerId } from "../../schemas";

import { FILTER_LABELS } from "./constants";

import type { OrderExtraFilters } from "./useOrderExtraFilters";

const CUSTOMER_ERROR_ID = "order-filter-customer-error";

/**
 * Lọc khách trên header cột Khách hàng (backoffice-erp-ui A5) — tham số BE `customerId` (URL `customer`).
 * Khách chọn theo tên / MST (`CustomerPicker` chế độ lọc, R3 WF4 UX audit — không bắt gõ UUID).
 * `GET /customers` của BE chặn ORDER_COORDINATOR / ACCOUNTANT (403): vai trò không có `customer-customers:READ` giữ ô
 * nhập UUID dự phòng (và nút lọc nhanh theo khách của dòng trong ô). BE nhận UUID — giá trị khác giữ ở ô nhập kèm lỗi
 * inline, không lên URL / không gọi API. Chỉ áp khi Enter / rời ô, tránh gọi API mỗi phím.
 */
export function OrderCustomerFilter({ extra }: { extra: OrderExtraFilters }) {
  const canPickCustomer = useCan(CUSTOMER_PERMISSIONS.read);
  if (canPickCustomer) {
    return (
      <HeaderFilterPopover
        label="khách hàng"
        active={extra.customerInput !== ""}
        onClear={() => extra.setCustomerId("")}
        className="w-96"
      >
        <div className="px-1 pt-1">
          <CustomerPicker
            idPrefix="order-filter"
            mode="filter"
            value={extra.customerId}
            onChange={extra.setCustomerId}
          />
        </div>
      </HeaderFilterPopover>
    );
  }
  return <OrderCustomerIdFilter extra={extra} />;
}

/** Ô nhập UUID dự phòng cho vai trò không đọc được danh sách khách. */
function OrderCustomerIdFilter({ extra }: { extra: OrderExtraFilters }) {
  const [customerDraft, setCustomerDraft] = useState(extra.customerInput);
  const [syncedCustomer, setSyncedCustomer] = useState(extra.customerInput);
  // Báo lỗi sau khi người dùng chốt, hoặc ngay khi URL mang sẵn giá trị sai; sau đó kiểm theo phím
  const [customerTouched, setCustomerTouched] = useState(extra.customerIdInvalid);
  if (syncedCustomer !== extra.customerInput) {
    // URL đổi từ nơi khác (Đặt lại, back/forward, nút lọc trong ô) → đồng bộ lại ô nhập
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
    <HeaderFilterPopover
      label="khách hàng"
      // URL mang sẵn giá trị sai cũng tính là đang lọc — còn chỗ để bỏ
      active={extra.customerInput !== ""}
      onClear={() => extra.setCustomerId("")}
      className="w-80"
    >
      <div className="grid gap-1 px-1 pt-1">
        <label htmlFor="order-filter-customer" className="text-ink-tertiary text-xs">
          {FILTER_LABELS.customer}
        </label>
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
          autoFocus
          className="bg-bg-surface h-8 font-[family-name:var(--font-mono)] text-[0.8125rem]"
        />
        {customerError && (
          <p id={CUSTOMER_ERROR_ID} role="alert" className="text-danger text-xs">
            {FILTER_LABELS.customerInvalid}
          </p>
        )}
      </div>
    </HeaderFilterPopover>
  );
}
