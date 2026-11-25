"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { locationTone, TONE_FILL } from "./tone";

import type { LayoutShelf } from "@/features/warehouse-map/types";

const K = UI_LABELS.warehouseMap.pick;
const P = UI_LABELS.warehouseMap.panel;
const norm = (code: string) => code.trim().toUpperCase();

// `cn` chỉ nối chuỗi, không gộp class trùng thuộc tính: mỗi trạng thái một bộ viền / nền riêng, chọn đúng một
// (đã chọn > đang chứa thùng > gợi ý hạng nhất > gợi ý khác > thường).
const BUTTON_BASE =
  "flex w-full items-center gap-1.5 rounded-(--r-sm) border px-1.5 py-1 text-left focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none disabled:cursor-not-allowed";
const BUTTON_CLASS = `${BUTTON_BASE} bg-bg-surface border-border-default hover:bg-bg-muted disabled:hover:bg-transparent`;
const PICKED_CLASS = `${BUTTON_BASE} bg-positive/10 border-dot-positive`;
const MARKED_CLASS = `${BUTTON_BASE} bg-bg-surface border-dot-warning border-dashed hover:bg-bg-muted`;
const TOP_CLASS = `${BUTTON_BASE} bg-dot-info/20 border-dot-info font-semibold`;
const SUGGESTED_CLASS = `${BUTTON_BASE} bg-dot-info/5 border-dot-info/60 hover:bg-dot-info/10`;

function buttonClass(picked: boolean, marked: boolean, rank: number | null) {
  if (picked) return PICKED_CLASS;
  if (marked) return MARKED_CLASS;
  if (rank === 1) return TOP_CLASS;
  return rank === null ? BUTTON_CLASS : SUGGESTED_CLASS;
}

/**
 * Lưới bin của một kệ để chọn làm vị trí đích: tầng cao ở trên. Chỉ bin trong `pickable` bấm được (quy tắc do màn gọi
 * quyết định); bin đang chứa thùng (`marked`) có viền cam; bin gợi ý (`suggested`, theo thứ hạng) nền xanh dương kèm số
 * hạng, hạng nhất đậm nhất; bin đang chọn `aria-pressed`.
 */
export function ShelfBinPicker({
  shelf,
  marked,
  suggested = [],
  pickable,
  value,
  disabled,
  onPick,
}: {
  shelf: LayoutShelf;
  marked: ReadonlySet<string>;
  suggested?: readonly string[];
  pickable: ReadonlySet<string>;
  value: string;
  disabled: boolean;
  onPick: (code: string) => void;
}) {
  const levels = [...shelf.levels].sort((a, b) => b.levelIndex - a.levelIndex);
  const bins = levels.flatMap((level) => level.bins);
  const rankOf = new Map(suggested.map((code, index) => [norm(code), index + 1]));
  return (
    <section aria-label={K.shelfBins(shelf.code)} className="space-y-1.5">
      <h4 className="text-ink-secondary text-xs font-medium">{K.shelfBins(shelf.code)}</h4>
      {bins.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{K.noBins}</p>
      ) : (
        <ol className="space-y-1">
          {levels.map((level) => (
            <li key={level.id} className="flex items-start gap-2">
              <span className="text-ink-tertiary w-12 shrink-0 pt-1 text-[0.6875rem]">
                {P.level(level.levelIndex)}
              </span>
              <ul className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1">
                {level.bins.map((bin) => {
                  const code = norm(bin.locationCode);
                  const isMarked = marked.has(code);
                  const canPick = pickable.has(code);
                  const picked = code === value;
                  const rank = rankOf.get(code) ?? null;
                  return (
                    <li key={bin.id}>
                      <button
                        type="button"
                        disabled={disabled || !canPick}
                        aria-pressed={picked}
                        aria-label={K.bin(code, isMarked, canPick, rank)}
                        onClick={() => onPick(code)}
                        className={buttonClass(picked, isMarked, rank)}
                      >
                        <svg viewBox="0 0 8 8" className="size-2 shrink-0" aria-hidden>
                          <circle
                            cx={4}
                            cy={4}
                            r={4}
                            className={TONE_FILL[locationTone(bin.effectiveStatus)]}
                          />
                        </svg>
                        <span
                          className={cn(
                            "truncate font-[family-name:var(--font-mono)] text-[0.6875rem]",
                            canPick ? "text-ink-primary" : "text-ink-tertiary",
                          )}
                        >
                          {code}
                        </span>
                        {rank !== null && (
                          <span className="text-ink-secondary ml-auto shrink-0 font-[family-name:var(--font-mono)] text-[0.625rem] tabular-nums">
                            {K.rank(rank)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
