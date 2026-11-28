import { SHORTAGE_LABELS, SHORTAGE_OPTION_LABELS } from "@/constants";
import { shortageOptionEffects } from "@/lib/domain/shortage-card";

import type { ShortageCard, ShortageCardOption } from "@/lib/domain/shortage-card";

/**
 * Các hướng khách được chọn kèm hệ quả tiền / ngày (cùng câu với thẻ trong chat — `shortageOptionEffects`). Hướng khách đã
 * chọn được đánh dấu. `expectedDateSource` (ngày dự kiến lấy từ Đơn sản xuất hay thời gian sản xuất chuẩn) chỉ nhân viên thấy.
 */
export function ShortageOptionList({
  card,
  options,
  chosen,
  expectedDateSource,
}: {
  card: Pick<ShortageCard, "missingCartons" | "batch">;
  options: readonly ShortageCardOption[];
  chosen?: ShortageCardOption["option"];
  expectedDateSource?: string | null;
}) {
  return (
    <div>
      <h3 className="text-ink-secondary mb-1.5 text-xs font-medium">
        {SHORTAGE_LABELS.offeredTitle}
      </h3>
      <ul className="space-y-1.5">
        {options.map((option) => (
          <li
            key={option.option}
            className={`rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] ${
              chosen === option.option
                ? "border-accent bg-accent/5"
                : "border-border-default bg-bg-surface"
            }`}
          >
            <p className="text-ink-primary font-medium">{SHORTAGE_OPTION_LABELS[option.option]}</p>
            {shortageOptionEffects(option, card).map((line) => (
              <p key={line} className="text-ink-secondary text-xs">
                {line}
              </p>
            ))}
            {option.option === "WAIT_FOR_PRODUCTION" &&
              expectedDateSource &&
              SHORTAGE_LABELS.expectedSource[expectedDateSource] && (
                <p className="text-ink-tertiary text-xs">
                  {SHORTAGE_LABELS.expectedSource[expectedDateSource]}
                </p>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}
