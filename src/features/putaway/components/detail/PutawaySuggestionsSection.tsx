"use client";

import { MapPin } from "lucide-react";

import { PUTAWAY_DETAIL_LABELS, PUTAWAY_TASK_STATUS } from "@/constants";
import { freeVolumeText, freeWeightText } from "@/features/putaway/selectors";

import { SlottingSuggestionList } from "@/components/backoffice/SlottingSuggestionList";
import { Alert } from "@/components/shared/Alert";
import { DetailSection } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { SlottingSuggestionLabels } from "@/components/backoffice/SlottingSuggestionList";
import type { PutawaySuggestion, PutawayTask } from "@/features/putaway/types";

const L = PUTAWAY_DETAIL_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

export const SUGGESTION_LABELS: SlottingSuggestionLabels = {
  ...L.suggestionColumns,
  freeVolume: L.freeVolume,
  freeWeight: L.freeWeight,
  unlimited: L.unlimited,
  choose: L.choose,
  chooseBin: L.chooseBin,
  chosen: L.chosen,
};

/** Bin gợi ý → dòng hiển thị: lý do dịch, m³ / kg đã định dạng (null = không giới hạn). */
export function suggestionItems(suggestions: readonly PutawaySuggestion[]) {
  return suggestions.map((s) => {
    const volume = freeVolumeText(s.freeVolumeM3);
    const weight = freeWeightText(s.freeWeightKg);
    return {
      locationCode: s.locationCode,
      reason: L.reason[s.reason],
      freeVolume: volume === null ? null : L.cubicMeters(volume),
      freeWeight: weight === null ? null : L.kilograms(weight),
    };
  });
}

/**
 * Bin gợi ý của thùng (docs 05 §4.3): tối đa 10 bin xếp theo nhóm cố định, kèm lý do + chỗ còn trống — không điểm
 * số. Rỗng → khu OVERFLOW của kho (BR-13) hoặc báo không có. `onChoose` vắng (chỉ xem / đã cất) = không có nút chọn.
 */
export function PutawaySuggestionsSection({
  task,
  selected,
  onChoose,
  title = L.suggestions,
  footer,
}: {
  task: PutawayTask;
  selected: string | null;
  onChoose?: (locationCode: string) => void;
  title?: string;
  /**
   * Dòng cuối mục, căn phải (vd "Cất thùng này" ở trang Gợi ý vị trí). Không đặt trên dòng tiêu đề: tiêu đề có LPN
   * dài, ở 1024px nút bị đẩy tràn khỏi thẻ.
   */
  footer?: ReactNode;
}) {
  const done = task.status === PUTAWAY_TASK_STATUS.DONE;
  return (
    <DetailSection title={title} icon={MapPin}>
      {done ? (
        <p className="text-ink-secondary text-[0.8125rem]">{L.suggestionsDone}</p>
      ) : task.suggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-ink-secondary text-xs">{L.suggestionsHint}</p>
          <SlottingSuggestionList
            items={suggestionItems(task.suggestions)}
            labels={SUGGESTION_LABELS}
            selected={selected}
            onChoose={onChoose}
          />
        </div>
      ) : (
        <Alert tone="warning" title={L.noSuggestion}>
          {task.overflowLocationCodes.length > 0 ? (
            <div className="space-y-2">
              <p>{L.overflowHint}</p>
              <div className="flex flex-wrap gap-2">
                {task.overflowLocationCodes.map((code) =>
                  onChoose ? (
                    <Button
                      key={code}
                      type="button"
                      variant="outline"
                      size="xs"
                      aria-label={L.chooseBin(code)}
                      onClick={() => onChoose(code)}
                      className={`border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted h-7 rounded-[var(--r-sm)] px-2.5 text-xs ${MONO}`}
                    >
                      {code}
                    </Button>
                  ) : (
                    <span key={code} className={MONO}>
                      {code}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : (
            <p>{L.noOverflow}</p>
          )}
        </Alert>
      )}
      {footer && <div className="mt-3 flex justify-end">{footer}</div>}
    </DetailSection>
  );
}
