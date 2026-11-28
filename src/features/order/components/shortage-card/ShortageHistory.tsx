import { SHORTAGE_LABELS } from "@/constants";

import { ShortageCardFacts, ShortageCardHeading } from "./ShortageStatusLine";

import type { ShortageStaffCard } from "../../shortage-card-schemas";

/** Các thẻ đã gửi cho đơn (mới nhất trước, theo BE): trạng thái, hướng khách chọn, ai thực hiện, vì sao hết hiệu lực. */
export function ShortageHistory({ cards }: { cards: readonly ShortageStaffCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div>
      <h3 className="text-ink-secondary mb-1.5 text-xs font-medium">
        {SHORTAGE_LABELS.historyTitle} ({cards.length})
      </h3>
      <ul className="divide-y divide-[var(--table-line)]">
        {cards.map((staff) => (
          <li key={staff.card.cardId} className="space-y-1 py-2">
            <ShortageCardHeading card={staff.card} />
            <ShortageCardFacts staff={staff} />
          </li>
        ))}
      </ul>
    </div>
  );
}
