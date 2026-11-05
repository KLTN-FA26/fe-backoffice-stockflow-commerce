/**
 * Màu cảnh 3D theo theme của app. WebGL không đọc được CSS variable, nên màu nền/khung/lưới được
 * lấy từ chính token của repo (`globals.css`: `--bg-subtle`, `--bg-muted`, `--ink-secondary`,
 * `--border-strong`, `--border-default`) qua `getComputedStyle` — sáng/tối đổi theo token, không
 * nhân đôi bảng hex. Thiếu token (SSR, test) thì rơi về màu sáng trong `SCENE_COLORS`.
 */

import { SCENE_COLORS } from "@/constants";

export interface SceneTheme {
  background: string;
  shellFill: string;
  shellEdge: string;
  gridMajor: string;
  gridMinor: string;
}

export const LIGHT_SCENE_THEME: SceneTheme = {
  background: SCENE_COLORS.background,
  shellFill: SCENE_COLORS.shellFill,
  shellEdge: SCENE_COLORS.shellEdge,
  gridMajor: SCENE_COLORS.gridMajor,
  gridMinor: SCENE_COLORS.gridMinor,
};

const TOKENS: Record<keyof SceneTheme, string> = {
  background: "--bg-subtle",
  shellFill: "--bg-muted",
  shellEdge: "--ink-secondary",
  gridMajor: "--border-strong",
  gridMinor: "--border-default",
};

export function readSceneTheme(root: HTMLElement = document.documentElement): SceneTheme {
  const style = getComputedStyle(root);
  const read = (key: keyof SceneTheme): string =>
    style.getPropertyValue(TOKENS[key]).trim() || LIGHT_SCENE_THEME[key];
  return {
    background: read("background"),
    shellFill: read("shellFill"),
    shellEdge: read("shellEdge"),
    gridMajor: read("gridMajor"),
    gridMinor: read("gridMinor"),
  };
}
