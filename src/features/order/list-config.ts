/**
 * Order list — cấu hình trang danh sách `/admin/orders`.
 *
 * Ranh giới state (state-persistence.md): filter/search/status/page sống trên URL
 * (nuqs, xem `useUrlFilters`); file này CHỈ giữ phần "sở thích hiển thị" lưu
 * localStorage qua `usePageConfig` — cột hiển thị, trường search, search trong cột,
 * bật/tắt stats.
 */

import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  Package,
  ReceiptText,
  Truck,
} from "lucide-react";

import { STORAGE_KEYS } from "@/constants";
import type { ListStatItem } from "@/components/shared/ListStatsPanel";
import { formatCompact } from "@/lib/format";

import type { OrderListStats } from "./selectors";
import type { Order } from "./types";

export type OrderSearchField = "orderNumber" | "recipientName" | "recipientPhone" | "orderId";
export type OrderColumnSearchKey = "orderNumber" | "recipientName";
export type OrderTableColumnKey =
  "orderNumber" | "recipientName" | "placedAt" | "grandTotal" | "status" | "actions";

export interface OrdersPageConfig {
  showStats: boolean;
  searchFields: OrderSearchField[];
  columnSearch: Partial<Record<OrderColumnSearchKey, string>>;
  visibleColumns: OrderTableColumnKey[];
}

export const ORDERS_STORAGE_KEY = STORAGE_KEYS.adminOrdersConfig;

export const DEFAULT_VISIBLE_COLUMNS: OrderTableColumnKey[] = [
  "orderNumber",
  "recipientName",
  "placedAt",
  "grandTotal",
  "status",
  "actions",
];

export const DEFAULT_SEARCH_FIELDS: OrderSearchField[] = ["orderNumber", "recipientName"];

export const DEFAULT_ORDERS_CONFIG: OrdersPageConfig = {
  showStats: false,
  searchFields: DEFAULT_SEARCH_FIELDS,
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};

export function mergeOrdersConfig(
  stored: Partial<OrdersPageConfig>,
  fallback: OrdersPageConfig,
): OrdersPageConfig {
  return {
    ...fallback,
    ...stored,
    searchFields: stored.searchFields?.length ? stored.searchFields : fallback.searchFields,
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}

export const ORDER_SEARCH_FIELDS: {
  label: string;
  value: OrderSearchField;
  getValue: (order: Order) => string;
}[] = [
  { label: "Mã đơn", value: "orderNumber", getValue: (order) => order.orderNumber },
  { label: "Khách", value: "recipientName", getValue: (order) => order.recipientName },
  { label: "SĐT", value: "recipientPhone", getValue: (order) => order.recipientPhone },
  { label: "Order ID", value: "orderId", getValue: (order) => order.orderId },
];

export const ORDER_COLUMN_SEARCH_LABELS: Record<OrderColumnSearchKey, string> = {
  orderNumber: "Mã đơn",
  recipientName: "Khách",
};

export const ORDER_TABLE_COLUMN_LABELS: Record<OrderTableColumnKey, string> = {
  orderNumber: "Mã đơn",
  recipientName: "Khách",
  placedAt: "Ngày đặt",
  grandTotal: "Tổng tiền",
  status: "Trạng thái",
  actions: "Thao tác",
};

/** Ghép nhãn + icon quanh các con số thuần từ `computeOrderStats`. */
export function orderStatTiles(stats: OrderListStats): ListStatItem[] {
  return [
    { label: "Tổng đơn", value: stats.total.toString(), icon: ClipboardList },
    { label: "Chờ thanh toán", value: stats.pendingPayment.toString(), icon: Clock },
    { label: "Đang xử lý", value: stats.processing.toString(), icon: Package },
    { label: "Đang giao", value: stats.shipping.toString(), icon: Truck },
    { label: "Đã giao", value: stats.delivered.toString(), icon: CheckCircle },
    { label: "Cần chú ý", value: stats.attention.toString(), icon: AlertTriangle },
    { label: "Doanh thu", value: formatCompact(stats.revenue), icon: ReceiptText },
  ];
}
