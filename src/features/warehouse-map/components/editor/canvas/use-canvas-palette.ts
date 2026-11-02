"use client";

import { useMemo } from "react";

import { useCssColor } from "../../map/use-css-color";

/**
 * Màu của canvas Konva đọc từ token CSS lúc chạy (canvas không hiểu class Tailwind) — một nguồn màu,
 * đổi sáng / tối là vẽ lại. Màu zone là DỮ LIỆU BE, không nằm ở đây.
 */
export function useCanvasPalette() {
  const color = useCssColor();
  return useMemo(
    () => ({
      ink: color("--ink-primary"),
      inkSoft: color("--ink-tertiary"),
      border: color("--border-default"),
      strong: color("--border-strong"),
      surface: color("--bg-surface"),
      subtle: color("--bg-subtle"),
      muted: color("--bg-muted"),
      info: color("--dot-info"),
      warning: color("--dot-warning"),
      danger: color("--dot-danger"),
      mono: color("--font-mono"),
      sans: color("--font-sans"),
    }),
    [color],
  );
}

export type CanvasPalette = ReturnType<typeof useCanvasPalette>;
