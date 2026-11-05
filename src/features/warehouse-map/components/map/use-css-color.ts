"use client";

import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme-provider";

/**
 * Đọc giá trị biến CSS (token màu trong `globals.css`) lúc chạy cho three.js — một nguồn màu, không hex
 * trong component. Như `useSceneTheme` của load-planning: `ThemeProvider` đổi `data-theme` trong effect
 * của nó (chạy SAU effect của con) nên chờ một khung hình rồi mới đọc lại.
 */
export function useCssColor(): (cssVar: string) => string {
  const { theme } = useTheme();
  const [readAt, setReadAt] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReadAt((count) => count + 1));
    return () => cancelAnimationFrame(frame);
  }, [theme]);
  return useMemo(() => {
    // `readAt` đổi sau mỗi lần đổi theme → đọc lại bảng style hiện hành của <html>
    const style = readAt >= 0 ? getComputedStyle(document.documentElement) : null;
    return (cssVar: string) => style?.getPropertyValue(cssVar).trim() || "gray";
  }, [readAt]);
}
