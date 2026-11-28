/**
 * ƯỚC TÍNH DỰ PHÒNG điều kiện một đơn đã giao tự chuyển `Completed`, rồi `Closed` (docs 17 §4.6 bước 21–22; BE
 * `Order.complete()` / `Order.close()` gọi từ `OrderSettlementJob` lúc 00:30 mỗi đêm). Hàm thuần.
 *
 * WF-05 BO-02: BE trả khối điều kiện của chính nó (`OrderResponse.settlementReadiness`, F-1) — khi có, màn đơn CHỈ hiển thị
 * khối đó và không gọi hàm này (BO không tính lại luật BE đã tính). Hàm này chỉ chạy khi BE chưa trả khối (BE cũ), với
 * hai sửa của C-7: hạn đổi trả lấy theo hợp đồng (mặc định 7), và đơn không có lịch thanh toán coi như không nợ. Những
 * điều kiện còn thiếu so với BE (hoá đơn phí vận chuyển, điều kiện đóng của nhánh hoàn tiền) cố ý không bịa ở đây —
 * màn ghi rõ đây là ước tính.
 */

const DAY_MS = 86_400_000;
/** Giờ Việt Nam: UTC+7, không đổi giờ (BE `BusinessCalendar.ZONE`). */
const VN_OFFSET_MS = 7 * 3_600_000;
/** Mặc định của BE `stockflow.order.return-window-days` (hợp đồng không ghi hạn) / `close-after-days`. */
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
  /**
   * Còn phải thu trên các đợt: 0 cả khi đơn KHÔNG có lịch thanh toán (BE: đơn không có đợt không "nợ" — C-7);
   * null = chưa đọc được (đang tải / lỗi / không có quyền).
   */
  outstanding: number | null;
  /** Hạn đổi trả của hợp đồng (ngày); vắng / null → mặc định `RETURN_WINDOW_DAYS`. */
  returnWindowDays?: number | null;
  /** Các lần giao đã giao thành công. */
  deliveredShipmentIds: readonly string[];
  /** Các lần giao đã có hoá đơn (gốc hoặc thay thế) `ISSUED`. */
  invoicedShipmentIds: readonly string[];
  /**
   * WF-05 GH-2: Sale đang giữ hoàn tất (BE `OrderCompletionHolds` — lần chạy đêm bỏ qua đơn có lần giữ mở). `null` =
   * chưa đọc được; vắng (undefined) = màn không biết về giữ hoàn tất → không thêm điều kiện này.
   */
  completionHeld?: boolean | null;
}

export interface CompletionCheck {
  key: "returnWindow" | "paid" | "noOpenReturn" | "invoiced" | "notHeld";
  label: string;
  met: boolean;
  detail?: string;
}

const fmt = (date: Date) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(
    date,
  );

/** Điều kiện "không bị giữ hoàn tất" (WF-05 GH-2) — chỉ khi màn biết tình trạng giữ. */
function holdCheck(held: boolean | null | undefined): CompletionCheck[] {
  if (held === undefined) return [];
  return [
    {
      key: "notHeld",
      label: "Không bị Sale giữ hoàn tất",
      met: held === false,
      detail:
        held === null
          ? "Chưa đọc được tình trạng giữ hoàn tất"
          : held
            ? "Đang giữ để xác minh lần giao — gỡ giữ ở thẻ “Giữ hoàn tất”"
            : undefined,
    },
  ];
}

/**
 * Các điều kiện hoàn tất của đơn `Delivered` (BE `Order.complete`), theo thứ tự hiển thị: bốn điều kiện của đơn, thêm
 * "không bị giữ hoàn tất" khi màn biết tình trạng giữ (WF-05 GH-2).
 */
export function completionChecks(facts: CompletionFacts, now = new Date()): CompletionCheck[] {
  const windowDays = facts.returnWindowDays ?? RETURN_WINDOW_DAYS;
  const windowEnd = facts.deliveredAt ? endOfDays(facts.deliveredAt, windowDays) : null;
  const missing = facts.deliveredShipmentIds.filter(
    (id) => !facts.invoicedShipmentIds.includes(id),
  );
  return [
    {
      key: "returnWindow",
      label: `Hết hạn đổi / trả ${windowDays} ngày`,
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
      label: "Mọi lô giao đã có hoá đơn điện tử phát hành",
      met: missing.length === 0,
      detail:
        missing.length > 0 ? `Còn ${missing.length} lô giao chưa có hoá đơn phát hành` : undefined,
    },
    ...holdCheck(facts.completionHeld),
  ];
}

/** Ngày đơn `Completed` sẽ tự đóng (`Closed`) — BE `Order.close`: hoàn tất + 30 ngày, không còn nợ. Chỉ dự phòng. */
export function closingDate(completedAt: string): Date {
  return new Date(Date.parse(completedAt) + CLOSE_AFTER_DAYS * DAY_MS);
}
