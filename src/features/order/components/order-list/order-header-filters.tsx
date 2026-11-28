"use client";

import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  HeaderMultiOptionFilter,
  HeaderNumberRangeFilter,
} from "@/components/shared/ColumnHeaderFilter";

import { FEE_BEARER_LABELS } from "@/constants";

import { STATUS_OPTIONS } from "./constants";
import { OrderCustomerFilter } from "./OrderCustomerFilter";

import type { ReactNode } from "react";
import type { OrderListState } from "./useOrderListState";

const FEE_BEARER_OPTIONS = [
  { value: "COMPANY", label: FEE_BEARER_LABELS.optionLabel("COMPANY") },
  { value: "CUSTOMER", label: FEE_BEARER_LABELS.optionLabel("CUSTOMER") },
] as const;

/**
 * Lọc trên header cột (backoffice-erp-ui A5) của danh sách đơn — đúng tham số BE `GET /orders`:
 * - Mã đơn / Người nhận (gõ chữ) → BE thu hẹp bằng `search`, FE lọc đúng cột trên trang đang xem;
 * - Khách hàng → `customerId` (UUID); Ngày đặt → `placedFrom` / `placedTo`; Trạng thái → `status` (chọn nhiều).
 * - Tổng tiền (khoảng) → BE không có tham số, chỉ lọc trang đang xem (chú thích bảng nói rõ).
 */
export function orderHeaderFilters(s: OrderListState): Partial<Record<string, ReactNode>> {
  const { extra, filters } = s;
  return {
    orderNumber: (
      <ColumnFilterButton
        label="mã đơn"
        value={extra.numberText}
        placeholder="Tìm theo mã đơn…"
        onChange={extra.setNumberText}
      />
    ),
    customer: <OrderCustomerFilter extra={extra} />,
    recipient: (
      <ColumnFilterButton
        label="người nhận"
        value={extra.recipientText}
        placeholder="Tìm theo tên hoặc SĐT người nhận…"
        onChange={extra.setRecipientText}
      />
    ),
    placedAt: (
      <HeaderDateRangeFilter
        label="ngày đặt"
        quickKind="past"
        from={extra.placedFrom}
        to={extra.placedTo}
        onChange={extra.setPlacedRange}
      />
    ),
    payment: (
      <HeaderOptionFilter
        label={FEE_BEARER_LABELS.filter}
        value={extra.feeBearer || null}
        options={FEE_BEARER_OPTIONS}
        onChange={(value) => extra.setFeeBearer(value ?? "")}
        searchPlaceholder={FEE_BEARER_LABELS.filterSearch}
        emptyLabel={FEE_BEARER_LABELS.filterEmpty}
      />
    ),
    totalAmount: (
      <HeaderNumberRangeFilter
        label="tổng tiền"
        from={extra.totalFrom}
        to={extra.totalTo}
        onChange={extra.setTotalRange}
      />
    ),
    status: (
      <HeaderMultiOptionFilter
        label="trạng thái"
        values={filters.status}
        options={STATUS_OPTIONS}
        onToggle={(value) => {
          const status = STATUS_OPTIONS.find((o) => o.value === value)?.value;
          if (status) s.toggleStatus(status);
        }}
        onClear={() => void filters.setStatus([])}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };
}
