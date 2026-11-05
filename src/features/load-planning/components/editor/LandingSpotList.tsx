"use client";

import { useState } from "react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { formatLWH } from "../../lib/dims";

import type { KeyboardEvent } from "react";
import type { LandingGhost } from "../../lib/empty-spaces";

const S = UI_LABELS.loadPlan.editor.tray.spotList;

/**
 * Cách đặt kiện từ khay KHÔNG cần chuột: danh sách vị trí đặt được (cùng các ô xanh trong khung 3D) dạng listbox. Mũi tên
 * lên / xuống / Home / End đổi vị trí đang chọn (ô tương ứng sáng lên trong 3D qua `onActive`), Enter hoặc Space đặt.
 * Mỗi mục có tên đọc được: số xe, toạ độ, kích thước, độ đỡ.
 */
export function LandingSpotList({
  ghosts,
  vehicleSeq,
  onPlace,
  onActive,
}: {
  ghosts: readonly LandingGhost[];
  vehicleSeq: number;
  onPlace: (id: string) => void;
  /** Ô gợi ý đang chọn bằng bàn phím (null khi rời danh sách). */
  onActive: (id: string | null) => void;
}) {
  const [index, setIndex] = useState(0);
  if (ghosts.length === 0) return null;
  const current = Math.min(index, ghosts.length - 1);
  const move = (to: number) => {
    const next = Math.max(0, Math.min(ghosts.length - 1, to));
    setIndex(next);
    onActive(ghosts[next].id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const keys: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: ghosts.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      move(keys[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPlace(ghosts[current].id);
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-ink-primary text-xs font-medium">{S.title}</p>
      <p className="text-ink-tertiary text-xs">{S.hint}</p>
      <ul
        role="listbox"
        aria-label={S.aria}
        aria-activedescendant={`landing-spot-${ghosts[current].id}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => onActive(ghosts[current].id)}
        onBlur={() => onActive(null)}
        className="border-border-default max-h-40 overflow-y-auto rounded border"
      >
        {ghosts.map((ghost, i) => (
          <li
            key={ghost.id}
            id={`landing-spot-${ghost.id}`}
            role="option"
            aria-selected={i === current}
            onClick={() => onPlace(ghost.id)}
            onMouseEnter={() => move(i)}
            className={cn(
              "cursor-pointer px-2 py-1 text-xs tabular-nums",
              i === current && "bg-bg-subtle font-medium",
            )}
          >
            {S.option(
              vehicleSeq,
              Math.round(ghost.xMm),
              Math.round(ghost.yMm),
              Math.round(ghost.zMm),
              formatLWH(ghost),
              Math.round(ghost.supportRatio * 100),
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
