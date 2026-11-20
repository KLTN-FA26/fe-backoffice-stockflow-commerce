import { parseAsStringLiteral, useQueryState } from "nuqs";

export const SCHEDULE_TABS = ["batches", "orders"] as const;
export type ScheduleTab = (typeof SCHEDULE_TABS)[number];

/**
 * Tab đang mở của lịch trên URL (`?tab=`, state-persistence: gửi link thấy đúng tab). Chưa chọn → mở "Cần lập" khi
 * người dùng lập được Đơn sản xuất VÀ đang có đợt cần lập (việc phải làm trước); không thì "Đơn sản xuất đang mở" —
 * không mở sẵn một tab rỗng. `batchCount` vắng (đang tải) và URL chưa chọn → `null`: chưa biết tab, đừng hiện một
 * tab rồi nhảy sang tab khác khi dữ liệu về.
 */
export function useScheduleTab(canDrawUp: boolean, batchCount: number | undefined) {
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(SCHEDULE_TABS));
  const fallback: ScheduleTab | null =
    batchCount === undefined ? null : canDrawUp && batchCount > 0 ? "batches" : "orders";
  return { tab: tab ?? fallback, setTab: (next: ScheduleTab) => void setTab(next) };
}
