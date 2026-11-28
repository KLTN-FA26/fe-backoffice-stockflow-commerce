import {
  SHORTAGE_ENDED_LABELS,
  SHORTAGE_LABELS,
  SHORTAGE_STATUS_LABELS,
  SHORTAGE_STATUS_TONE_KEY,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { shortageCardName, shortageOptionLabel } from "@/lib/domain/shortage-card";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ShortageStaffCard } from "../../shortage-card-schemas";

/** Trạng thái thẻ (chấm + chữ) cùng tên thẻ: `TT-…` hoặc "Thẻ thiếu thùng ngày …" — không bao giờ UUID. */
export function ShortageCardHeading({ card }: { card: ShortageStaffCard["card"] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold">
        {shortageCardName(card)}
      </span>
      <StatusDot
        domain="order"
        status={SHORTAGE_STATUS_TONE_KEY[card.status]}
        label={SHORTAGE_STATUS_LABELS[card.status]}
      />
    </div>
  );
}

/** Ai làm gì lúc nào trên thẻ: gửi, khách chọn (bằng chứng), thực hiện, vì sao hết hiệu lực. */
export function ShortageCardFacts({ staff }: { staff: ShortageStaffCard }) {
  const { card } = staff;
  const L = SHORTAGE_LABELS;
  const lines = [
    card.sentAt && L.sentBy(staff.sentByName ?? "—", formatDateTime(card.sentAt)),
    card.salesNote && L.salesNote(card.salesNote),
    card.chosen &&
      L.chosen(shortageOptionLabel(card.chosen.option), formatDateTime(card.chosen.at)),
    card.chosen?.note && L.customerNote(card.chosen.note),
    card.executedAt &&
      (staff.executedByName
        ? L.executedBy(staff.executedByName, formatDateTime(card.executedAt))
        : L.executedAt(formatDateTime(card.executedAt))),
    card.endedReason && SHORTAGE_ENDED_LABELS[card.endedReason],
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
  return (
    <ul className="text-ink-secondary space-y-0.5 text-xs">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
