"use client";

import { DESIGN_STATUS_LABELS, DESIGN_STATUSES } from "@/constants";

import { toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";

import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
} from "@/components/shared/ColumnHeaderFilter";

import { quoteRequestName } from "../lifecycle";

import { QUOTE_REQUEST_STATUS_OPTIONS } from "./copy";
import type { QuoteRequest } from "../types";
import type { ReactNode } from "react";
import type { QuoteRequestFilters } from "./useQuoteRequestFilters";

const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);

/**
 * Lọc trên header cột (backoffice-erp-ui §5) của hai hộp yêu cầu báo giá:
 * - Trạng thái → `status` của BE (MỘT giá trị: chọn một; bỏ chọn = "Tất cả"), cùng khoá URL với bảng "Bộ lọc".
 * - Thiết kế / Dự án, Khách hàng, SKU phôi / SKU riêng (gõ chữ), Trạng thái thiết kế (chọn một), Giao mong muốn, Yêu cầu lúc (khoảng ngày) → BE không có tham số, nên chỉ
 *   lọc trang đang xem (`matchesQuoteRequestColumns`); chú thích bảng nói rõ phạm vi.
 */
export function quoteRequestHeaderFilters(
  filters: QuoteRequestFilters,
): Partial<Record<string, ReactNode>> {
  const f = filters.columnFilters;
  const set = filters.setColumnFilter;
  const name = (label: string) => (
    <ColumnFilterButton
      label={label}
      value={f.qrName}
      placeholder={`Tìm theo tên ${label}…`}
      onChange={(value) => set({ qrName: value })}
    />
  );
  const sku = (
    <ColumnFilterButton
      label="SKU"
      value={f.qrSku}
      placeholder="Tìm theo SKU…"
      onChange={(value) => set({ qrSku: value })}
    />
  );
  return {
    design: name("thiết kế"),
    project: name("dự án"),
    customer: (
      <ColumnFilterButton
        label="khách hàng"
        value={f.qrCustomer}
        placeholder="Tìm theo tên khách hàng…"
        onChange={(value) => set({ qrCustomer: value })}
      />
    ),
    sku,
    customerSku: sku,
    designStatus: (
      <HeaderOptionFilter
        label="trạng thái thiết kế"
        value={f.qrDesignStatus || null}
        options={DESIGN_STATUSES.map((value) => ({ value, label: DESIGN_STATUS_LABELS[value] }))}
        onChange={(value) => set({ qrDesignStatus: value ?? "" })}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
    delivery: (
      <HeaderDateRangeFilter
        label="ngày giao mong muốn"
        from={f.qrDeliveryFrom}
        to={f.qrDeliveryTo}
        onChange={({ from, to }) => set({ qrDeliveryFrom: from, qrDeliveryTo: to })}
      />
    ),
    requestedAt: (
      <HeaderDateRangeFilter
        label="ngày yêu cầu"
        from={f.qrRequestedFrom}
        to={f.qrRequestedTo}
        onChange={({ from, to }) => set({ qrRequestedFrom: from, qrRequestedTo: to })}
      />
    ),
    status: (
      <HeaderOptionFilter
        label="trạng thái"
        value={filters.status ?? null}
        options={QUOTE_REQUEST_STATUS_OPTIONS}
        onChange={(value) =>
          filters.setStatus(
            QUOTE_REQUEST_STATUS_OPTIONS.find((o) => o.value === value)?.value ?? null,
          )
        }
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
  };
}

const skusOf = (row: QuoteRequest) =>
  "lines" in row ? row.lines.map((line) => line.customerSku) : [row.sku, row.customerSku];

/** Có lọc nào chỉ chạy ở FE (ô tìm hoặc lọc cột ngoài trạng thái). */
export function quoteRequestPageFilterActive(filters: QuoteRequestFilters): boolean {
  return Boolean(filters.q.trim() || Object.values(filters.columnFilters).some((v) => v.trim()));
}

/** Dòng khớp ô tìm + lọc cột (chỉ trang đang xem). */
export function matchesQuoteRequestFilters(
  row: QuoteRequest,
  filters: QuoteRequestFilters,
): boolean {
  const f = filters.columnFilters;
  const q = filters.q;
  return (
    (!q.trim() ||
      [quoteRequestName(row), row.customerName, ...skusOf(row)].some((t) => textIncludes(t, q))) &&
    textIncludes(quoteRequestName(row), f.qrName) &&
    textIncludes(row.customerName, f.qrCustomer) &&
    (!f.qrSku.trim() || skusOf(row).some((t) => textIncludes(t, f.qrSku))) &&
    (!f.qrDesignStatus ||
      ("lines" in row
        ? row.lines.some((line) => line.designStatus === f.qrDesignStatus)
        : row.designStatus === f.qrDesignStatus)) &&
    (!(f.qrDeliveryFrom || f.qrDeliveryTo) ||
      (row.desiredDeliveryDate != null &&
        inRange(row.desiredDeliveryDate.slice(0, 10), f.qrDeliveryFrom, f.qrDeliveryTo))) &&
    inRange(toLocalIsoDate(row.requestedAt), f.qrRequestedFrom, f.qrRequestedTo)
  );
}
