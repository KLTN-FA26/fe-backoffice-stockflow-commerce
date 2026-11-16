/**
 * Hình thức giao của đơn — CHỈ ĐỌC dữ liệu cũ. BE đã bỏ lựa chọn này (docs 17 §4.2 bước 4, BR-16: mọi đơn giao
 * nguyên chuyến; V20261108000400): không còn chọn khi release, không còn `PUT /orders/{id}/delivery-mode`, lịch sử đơn
 * không còn mục đổi hình thức. Nhãn dưới đây chỉ để hiển thị các mục lịch sử cũ nếu BE còn trả.
 */

/** BE `order/api/DeliveryMode.java` (đã xoá) — còn trong dữ liệu lịch sử cũ. */
export const ORDER_DELIVERY_MODES = ["PARCEL", "FULL_TRUCKLOAD"] as const;

export const ORDER_DELIVERY_MODE_LABELS = {
  PARCEL: "Giao lẻ",
  FULL_TRUCKLOAD: "Nguyên xe (FTL)",
  UNKNOWN: "Không rõ",
} as const satisfies Record<(typeof ORDER_DELIVERY_MODES)[number] | "UNKNOWN", string>;

export const ORDER_DELIVERY_MODE_UI = {
  /** Hiện trong lịch sử đơn khi hình thức giao đổi (`DELIVERY_MODE_CHANGE`, dữ liệu cũ). */
  historyChanged: (from: string, to: string) => `Đổi hình thức giao: ${from} → ${to}`,
  historySet: (to: string) => `Chọn hình thức giao: ${to}`,
} as const;
