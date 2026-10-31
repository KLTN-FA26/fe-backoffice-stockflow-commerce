"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { statusText } from "./shape-utils";
import { locationTone, TONE_FILL } from "./tone";

import type { LayoutShelf } from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.panel;

/**
 * Mặt đứng kệ: tầng cao ở trên, tầng 1 ở dưới; mỗi bin là một ô có mã vị trí đầy đủ (BR-10) và chấm
 * theo `effectiveStatus`. Bin không dùng được (`usable` false) chữ mờ — nguồn sự thật tồn vẫn là tồn
 * theo vị trí (BR-05).
 */
export function ShelfLevelsGrid({ shelf }: { shelf: LayoutShelf }) {
  const levels = [...shelf.levels].sort((a, b) => b.levelIndex - a.levelIndex);
  if (levels.length === 0) return <p className="text-ink-tertiary text-xs">{P.noLevels}</p>;
  return (
    <ol className="space-y-1.5" aria-label={P.levels}>
      {levels.map((level) => (
        <li
          key={level.id}
          className="border-border-default bg-bg-subtle rounded-(--r-sm) border p-1.5"
        >
          <p className="text-ink-secondary mb-1 text-[0.6875rem] font-medium">
            {P.level(level.levelIndex)}
          </p>
          {level.bins.length === 0 ? (
            <p className="text-ink-tertiary text-xs">{P.noBins}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1">
              {level.bins.map((bin) => (
                <li
                  key={bin.id}
                  title={`${bin.locationCode} — ${statusText(bin.effectiveStatus)} · ${
                    bin.usable ? P.usable : P.notUsable
                  }`}
                  className="bg-bg-surface border-border-default flex items-center gap-1.5 rounded-(--r-sm) border px-1.5 py-1"
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
                      bin.usable ? "text-ink-primary" : "text-ink-tertiary line-through",
                    )}
                  >
                    {bin.locationCode}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
