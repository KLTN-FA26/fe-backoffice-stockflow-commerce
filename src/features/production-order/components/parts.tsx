"use client";

import { PRODUCTION_ORDER_STATUS_DISPLAY, PRODUCTION_ORDER_STATUS_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { EMPTY_CELL } from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ProductionOrderStatus } from "@/constants";
import type { ProducerRef } from "@/lib/references/producer-options";

/** Trạng thái Đơn sản xuất: tone theo chuỗi docs 17 §5.3 (status-map), nhãn tiếng Việt riêng của Đơn sản xuất. */
export function ProductionStatusDot({
  status,
  size = "sm",
}: {
  status: ProductionOrderStatus;
  size?: "sm" | "md";
}) {
  return (
    <StatusDot
      domain="order"
      size={size}
      status={PRODUCTION_ORDER_STATUS_DISPLAY[status]}
      label={PRODUCTION_ORDER_STATUS_LABELS[status]}
    />
  );
}

/** Cửa sổ giao "từ – đến" (docs 14 BR-23); thiếu đầu nào hiện "—" đầu đó. */
export function formatWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return EMPTY_CELL;
  return `${start ? formatDate(start) : EMPTY_CELL} – ${end ? formatDate(end) : EMPTY_CELL}`;
}

/** Mã rút gọn khi không tra được tên (thiếu quyền / bản ghi đã xoá) — không đoán tên. Chỉ còn dùng ở lịch sản xuất. */
export const shortId = (id: string): string => id.slice(0, 8);

/**
 * "Mã · Tên" của đơn vị sản xuất. Ưu tiên danh mục đơn vị (có mã); không có quyền đọc danh mục thì dùng tên BE kèm sẵn
 * trong đơn (FE#286); không có cả hai thì "—" — không hiện mảnh UUID.
 */
export function producerLabel(
  producer: ProducerRef | undefined,
  fallbackName?: string | null,
): string {
  if (producer) return `${producer.code} · ${producer.name}`;
  return fallbackName || EMPTY_CELL;
}
