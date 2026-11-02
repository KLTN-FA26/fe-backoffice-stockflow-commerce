"use client";

import { useEffect, useState } from "react";

/**
 * Xem bản đồ toàn màn hình: khung bản đồ phủ kín cửa sổ (lớp `--z-overlay`, dưới dialog / tooltip nên
 * modal chi tiết / thông số vẫn mở được) và xin trình duyệt vào chế độ toàn màn hình cho cả trang.
 * Trình duyệt từ chối (iframe, chính sách) thì vẫn còn lớp phủ. Esc / thoát fullscreen → về bình thường.
 */
export function useMapFullscreen() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    const onKey = (event: KeyboardEvent) => {
      // Trình duyệt không vào được fullscreen thật thì Esc tự thoát lớp phủ
      if (
        event.key === "Escape" &&
        !document.fullscreenElement &&
        !document.querySelector("[role=dialog]")
      )
        setActive(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  const toggle = () => {
    if (active) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setActive(false);
      return;
    }
    setActive(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return { active, toggle };
}

/** Khung bản đồ khi toàn màn hình (gắn kèm `group/map` + `data-fullscreen`): phủ kín cửa sổ. */
export const MAP_FULLSCREEN_FRAME_CLASS = "fixed inset-0 z-(--z-overlay) rounded-none border-0 p-3";

/**
 * Trang bản đồ cao đúng phần còn lại của cửa sổ (trừ topbar `h-14` và padding `p-4` của shell) — khung
 * bản đồ `flex-1` lấp kín tới mép dưới, không chừa khoảng trống dù bản đồ thấp hay cao.
 */
export const MAP_PAGE_CLASS = "flex h-[calc(100dvh-5.5rem)] min-h-[30rem] flex-col gap-3";
