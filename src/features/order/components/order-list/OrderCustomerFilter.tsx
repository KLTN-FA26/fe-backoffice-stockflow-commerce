"use client";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { HeaderFilterPopover } from "@/components/shared/ColumnHeaderFilter";

import { FILTER_LABELS } from "./constants";

import type { OrderExtraFilters } from "./useOrderExtraFilters";

/**
 * Lọc khách trên header cột Khách hàng (backoffice-erp-ui A5) — tham số BE `customerId` (URL `customer`, UUID).
 * Khách chọn theo tên / MST bằng `CustomerPicker` chế độ lọc (R3 — không bắt gõ UUID); URL vẫn mang UUID nên link và
 * back/forward giữ nguyên. `GET /customers` của BE chặn ORDER_COORDINATOR / ACCOUNTANT (403): vai trò không có
 * `customer-customers:READ` không có ô chọn, chỉ có một dòng chỉ sang nút lọc nhanh ở từng dòng (cột Khách hàng).
 */
export function OrderCustomerFilter({ extra }: { extra: OrderExtraFilters }) {
  const canPickCustomer = useCan(CUSTOMER_PERMISSIONS.read);

  return (
    <HeaderFilterPopover
      label="khách hàng"
      active={extra.customerId !== ""}
      onClear={() => extra.setCustomerId("")}
      className="w-80"
    >
      <div className="px-1 pt-1">
        {canPickCustomer ? (
          <CustomerPicker
            idPrefix="order-filter"
            mode="filter"
            value={extra.customerId}
            onChange={extra.setCustomerId}
          />
        ) : (
          <p className="text-ink-tertiary text-xs">{FILTER_LABELS.customerNoPicker}</p>
        )}
      </div>
    </HeaderFilterPopover>
  );
}
