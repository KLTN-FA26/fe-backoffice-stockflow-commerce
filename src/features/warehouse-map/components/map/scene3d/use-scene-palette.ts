"use client";

import { useMemo } from "react";

import { useCssColor } from "../use-css-color";

/**
 * Màu cảnh 3D đọc từ token CSS lúc chạy (three.js không hiểu class Tailwind): vật liệu `--scene-*`
 * (thép, gỗ, bê tông… giống nhau sáng / tối) + nền / chữ / tone theo theme. Màu zone là dữ liệu BE.
 */
export function useScenePalette() {
  const color = useCssColor();
  return useMemo(
    () => ({
      css: color,
      steel: color("--scene-steel"),
      beam: color("--scene-beam"),
      deck: color("--scene-deck"),
      pallet: color("--scene-pallet"),
      tote: color("--scene-tote"),
      ground: color("--scene-ground"),
      tape: color("--scene-tape"),
      wall: color("--scene-wall"),
      label: color("--scene-label"),
      carton: color("--scene-carton"),
      cartonDark: color("--scene-carton-dark"),
      cartonLight: color("--scene-carton-light"),
      cartonTape: color("--scene-carton-tape"),
      print: color("--scene-print"),
      sky: color("--bg-subtle"),
      gridCell: color("--border-default"),
      gridSection: color("--border-strong"),
      info: color("--dot-info"),
      warning: color("--dot-warning"),
    }),
    [color],
  );
}

export type ScenePalette = ReturnType<typeof useScenePalette>;
