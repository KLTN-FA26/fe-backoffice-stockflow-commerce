/**
 * Điều kiện một đơn đã giao tự chuyển `Completed`, rồi `Closed` (docs 17 §4.6 bước 21–22; BE
 * `Order.complete()` / `Order.close()` gọi từ `OrderSettlementJob` lúc 00:30 mỗi đêm). Hàm thuần —
 * màn đơn dùng để giải thích vì sao đơn chưa hoàn tất; BE mới là bên quyết định.
 *
 * Khác docs 17 (3 điều kiện): BE thêm điều kiện "mọi lần giao đã có hoá đơn điện tử phát hành"
 * (WF-05 plan §4, điều kiện 5) — xem DOC-01.
 */

const DAY_MS = 86_400_000;
/** Giờ Việt Nam: UTC+7, không đổi giờ (BE `BusinessCalendar.ZONE`). */
const VN_OFFSET_MS = 7 * 3_600_000;
/** BE `stockflow.order.return-window-days` / `close-after-days`. */
export const RETURN_WINDOW_DAYS = 7;
export const CLOSE_AFTER_DAYS = 30;

/**
 * BE `ReturnPolicy.endOfDays(from, days)`: ngày (giờ VN) của mốc + days + 1, lúc 0 giờ giờ VN — hết
 * trọn ngày thứ `days` sau ngày giao.
 */
export function endOfDays(fromIso: string, days: number): Date {
  const local = Date.parse(fromIso) + VN_OFFSET_MS;
  const startOfLocalDay = Math.floor(local / DAY_MS) * DAY_MS;
  return new Date(startOfLocalDay + (days + 1) * DAY_MS - VN_OFFSET_MS);
}

export interface CompletionFacts {
  /** Trạng thái hiển thị của đơn ("Delivered", "Completed", "Return Requested", …). */
  status: string;
  deliveredAt: string | null | undefined;
  completedAt: string | null | undefined;
  /** Còn phải thu trên các đợt (null = chưa biết / không có đợt). */
  outstanding: number | null;
  /** Các lần giao đã giao thành công. */
  deliveredShipmentIds: readonly string[];
  /** Các lần giao đã có hoá đơn (gốc hoặc thay thế) `ISSUED`. */
  invoicedShipmentIds: readonly string[];
}

export interface CompletionCheck {
  key: "returnWindow" | "paid" | "noOpenReturn" | "invoiced";
  label: string;
  met: boolean;
  detail?: string;
}

const fmt = (date: Date) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(
    date,
  );

/** Bốn điều kiện hoàn tất của đơn `Delivered` (BE `Order.complete`), theo thứ tự hiển thị. */
export function completionChecks(facts: CompletionFacts, now = new Date()): CompletionCheck[] {
  const windowEnd = facts.deliveredAt ? endOfDays(facts.deliveredAt, RETURN_WINDOW_DAYS) : null;
  const missing = facts.deliveredShipmentIds.filter(
    (id) => !facts.invoicedShipmentIds.includes(id),
  );
  return [
    {
      key: "returnWindow",
      label: `Hết hạn đổi / trả ${RETURN_WINDOW_DAYS} ngày`,
      met: windowEnd !== null && windowEnd.getTime() <= now.getTime(),
      detail: windowEnd
        ? `Hết hạn lúc 0 giờ ngày ${fmt(windowEnd)}`
        : "Chưa ghi nhận thời điểm giao",
    },
    {
      key: "paid",
      label: "Mọi đợt thanh toán đã trả đủ",
      met: facts.outstanding === 0,
      detail: facts.outstanding === null ? "Chưa đọc được các đợt thanh toán" : undefined,
    },
    {
      key: "noOpenReturn",
      label: "Không có yêu cầu trả hàng đang mở",
      met: facts.status !== "Return Requested",
    },
    {
      key: "invoiced",
      label: "Mọi lần giao đã có hoá đơn điện tử phát hành",
      met: missing.length === 0,
      detail:
        missing.length > 0 ? `Còn ${missing.length} lần giao chưa có hoá đơn phát hành` : undefined,
    },
  ];
}

/** Ngày đơn `Completed` sẽ tự đóng (`Closed`) — BE `Order.close`: hoàn tất + 30 ngày, không còn nợ. */
export function closingDate(completedAt: string): Date {
  return new Date(Date.parse(completedAt) + CLOSE_AFTER_DAYS * DAY_MS);
}
