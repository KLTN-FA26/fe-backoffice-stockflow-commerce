"use client";

import { LOAD_PLANNING_LABELS, VIEW_KINDS } from "@/constants";

import type { ViewKind } from "@/constants";

/** Nút góc nhìn nhanh — xe dài khó đọc từ góc chéo mặc định, một cú bấm đưa về khung dễ nhìn. */
export function ViewButtons({ onSelect }: { onSelect: (kind: ViewKind) => void }) {
  const labels = LOAD_PLANNING_LABELS.viewer;
  return (
    <div
      role="group"
      aria-label={labels.viewGroup}
      className="border-border-default bg-bg-surface/90 absolute top-2 right-2 z-10 flex overflow-hidden rounded-md border text-[11px] shadow-sm backdrop-blur-sm"
    >
      {VIEW_KINDS.map((kind, index) => (
        <button
          key={kind}
          type="button"
          onClick={() => onSelect(kind)}
          className={`text-ink-secondary hover:bg-bg-muted hover:text-ink-primary px-2 py-1 transition-colors ${
            index > 0 ? "border-border-default border-l" : ""
          }`}
        >
          {labels.views[kind]}
        </button>
      ))}
    </div>
  );
}
