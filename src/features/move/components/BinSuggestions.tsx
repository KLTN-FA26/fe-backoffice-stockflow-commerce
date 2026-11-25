"use client";

import { MOVE_LABELS, MOVE_SUGGESTION_LIST_LABELS } from "@/constants/move";

import { SlottingSuggestionList } from "@/components/backoffice/SlottingSuggestionList";
import { Skeleton } from "@/components/ui/skeleton";

import { suggestionItems } from "../selectors";

import type { BinSuggestions as Suggestions } from "../types";

const NOTE_CLASS = "text-ink-tertiary text-xs";
const MONO = "font-[family-name:var(--font-mono)]";

/**
 * Bin gợi ý cạnh ô vị trí đích (BE #412, docs 11 BR-10): xếp hạng như màn cất hàng, kèm lý do + chỗ còn trống. Bấm
 * "Chọn" là đặt dòng đó làm đích. Không bin nào nhận → các khu OVERFLOW (docs 05 BR-13). Chỉ để tham khảo: lỗi / đang
 * tải không chặn gửi lệnh, vẫn quét hoặc gõ vị trí khác được.
 */
export function BinSuggestions({
  hasCartons,
  data,
  isLoading,
  isError,
  value,
  disabled,
  onChoose,
}: {
  hasCartons: boolean;
  data: Suggestions | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Đích đang chọn (in hoa). */
  value: string;
  disabled: boolean;
  onChoose: (code: string) => void;
}) {
  return (
    <section aria-label={MOVE_LABELS.suggestionsTitle} className="space-y-1.5">
      <h3 className="text-ink-secondary text-xs font-medium">{MOVE_LABELS.suggestionsTitle}</h3>
      <Body
        hasCartons={hasCartons}
        data={data}
        isLoading={isLoading}
        isError={isError}
        value={value}
        disabled={disabled}
        onChoose={onChoose}
      />
    </section>
  );
}

function Body({
  hasCartons,
  data,
  isLoading,
  isError,
  value,
  disabled,
  onChoose,
}: Parameters<typeof BinSuggestions>[0]) {
  if (!hasCartons) return <p className={NOTE_CLASS}>{MOVE_LABELS.suggestionsIdle}</p>;
  if (isLoading)
    return (
      <div className="space-y-1" aria-label={MOVE_LABELS.suggestionsLoading} role="status">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  if (isError || !data) return <p className={NOTE_CLASS}>{MOVE_LABELS.suggestionsUnavailable}</p>;
  if (data.suggestions.length > 0)
    return (
      <div className="space-y-1.5">
        <p className={NOTE_CLASS}>{MOVE_LABELS.suggestionsHint}</p>
        <SlottingSuggestionList
          items={suggestionItems(data.suggestions)}
          labels={MOVE_SUGGESTION_LIST_LABELS}
          selected={value}
          onChoose={disabled ? undefined : onChoose}
        />
      </div>
    );
  return (
    <div className="space-y-1.5">
      <p className="text-ink-secondary text-xs">{MOVE_LABELS.suggestionsNone}</p>
      {data.overflowAreas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={NOTE_CLASS}>{MOVE_LABELS.suggestionsOverflow}</span>
          {data.overflowAreas.map((code) => (
            <button
              key={code}
              type="button"
              disabled={disabled}
              aria-pressed={code === value}
              aria-label={MOVE_LABELS.chooseOverflow(code)}
              onClick={() => onChoose(code)}
              className={`${MONO} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted focus-visible:ring-border-strong aria-pressed:border-brand rounded-(--r-sm) border px-1.5 py-0.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed`}
            >
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
