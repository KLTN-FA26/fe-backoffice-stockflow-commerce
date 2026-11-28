import { CONTRACT_SCHEDULE_LABELS } from "@/constants/labels-contract-schedule";

/** Dưới bảng lịch giao: "Giá trị đợt" chỉ gồm hàng, nên khác tổng đơn (S06-7). */
export function BatchValueNote() {
  return (
    <p className="text-ink-tertiary -mt-1 text-xs">{CONTRACT_SCHEDULE_LABELS.batchValueNote}</p>
  );
}
