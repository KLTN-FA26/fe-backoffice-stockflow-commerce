"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme-provider";

import { LIGHT_SCENE_THEME, readSceneTheme } from "../../lib/scene-theme";

import type { SceneTheme } from "../../lib/scene-theme";

/**
 * Màu cảnh 3D theo theme hiện tại của app. `ThemeProvider` đặt `data-theme` trong effect của nó, chạy
 * SAU effect của con, nên đọc token ngay trong effect này sẽ thấy giá trị cũ; chờ một khung hình rồi
 * mới đọc.
 */
export function useSceneTheme(): SceneTheme {
  const { theme } = useTheme();
  const [sceneTheme, setSceneTheme] = useState<SceneTheme>(LIGHT_SCENE_THEME);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSceneTheme(readSceneTheme()));
    return () => cancelAnimationFrame(frame);
  }, [theme]);
  return sceneTheme;
}
