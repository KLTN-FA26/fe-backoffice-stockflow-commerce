"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

const clamp = (value: number) => Math.min(Math.max(value, LIMITS.zoomMin), LIMITS.zoomMax);
/** Ctrl (Windows) hoặc ⌘ (macOS). */
const withPanKey = (event: { ctrlKey: boolean; metaKey: boolean }) =>
  event.ctrlKey || event.metaKey;

interface Anchor {
  /** Điểm nội dung (px, tính cả phần đã cuộn) đang nằm dưới con trỏ. */
  x: number;
  y: number;
  /** Vị trí con trỏ trong khung. */
  px: number;
  py: number;
  ratio: number;
}

/**
 * Zoom + kéo bản đồ trong một khung cuộn (`ref`) — giống nhau ở chế độ xem và sửa:
 * - Ctrl (⌘) + lăn chuột: zoom quanh con trỏ (nội dung rộng `zoom` lần khung); lăn thường vẫn cuộn.
 * - Ctrl (⌘) + kéo, kéo chuột giữa, hoặc bật công cụ bàn tay (`hand`, phím H) rồi kéo: dời bản đồ.
 *   Kéo thường để chọn (xem) / vẽ, dời hình (sửa).
 * Kéo quá `panThreshold` px thì nuốt cú click kết thúc cú kéo để không chọn nhầm hình.
 */
export function usePanZoom({ hand = false }: { hand?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(LIMITS.zoomMin);
  const [panning, setPanning] = useState(false);
  const [panKeyHeld, setPanKeyHeld] = useState(false);
  const anchor = useRef<Anchor | null>(null);
  const dragged = useRef(false);

  // Giữ Ctrl → con trỏ bàn tay, canvas sửa tạm không nhận chuột (cú kéo chỉ dời bản đồ)
  useEffect(() => {
    const sync = (event: KeyboardEvent) => setPanKeyHeld(withPanKey(event));
    const release = () => setPanKeyHeld(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", release);
    };
  }, []);

  const zoomTo = (target: number, point?: { x: number; y: number }) => {
    const el = ref.current;
    const next = clamp(target);
    if (!el || next === zoom) return;
    const px = point?.x ?? el.clientWidth / 2;
    const py = point?.y ?? el.clientHeight / 2;
    anchor.current = { x: el.scrollLeft + px, y: el.scrollTop + py, px, py, ratio: next / zoom };
    setZoom(next);
  };

  // Sau khi nội dung đổi cỡ: cuộn sao cho điểm dưới con trỏ đứng yên
  useLayoutEffect(() => {
    const el = ref.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.x * a.ratio - a.px;
    el.scrollTop = a.y * a.ratio - a.py;
    anchor.current = null;
  }, [zoom]);

  // Ctrl + lăn = zoom (listener thường để chặn zoom cả trang của trình duyệt — React gắn wheel passive)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!withPanKey(event)) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(zoom * Math.exp(-event.deltaY * 0.0015), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (event: ReactPointerEvent) => {
    const el = ref.current;
    const pan = event.button === 1 || (event.button === 0 && (hand || withPanKey(event)));
    if (!el || !pan) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    dragged.current = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < LIMITS.panThreshold) return;
      dragged.current = true;
      setPanning(true);
      el.scrollLeft = start.left - dx;
      el.scrollTop = start.top - dy;
    };
    const up = () => {
      setPanning(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return {
    ref,
    zoom,
    /** Bàn tay đang bật, đang giữ Ctrl / ⌘, hoặc đang kéo — canvas sửa ngừng nhận chuột. */
    panMode: hand || panKeyHeld || panning,
    /** Class con trỏ của khung: bàn tay khi sẵn sàng kéo, nắm tay khi đang kéo. */
    cursorClass: panning ? "cursor-grabbing" : hand || panKeyHeld ? "cursor-grab" : undefined,
    bind: {
      onPointerDown,
      // Vừa kéo bản đồ → bỏ cú click kết thúc cú kéo (không chọn / bỏ chọn nhầm)
      onClickCapture: (event: ReactMouseEvent) => {
        if (!dragged.current) return;
        dragged.current = false;
        event.stopPropagation();
        event.preventDefault();
      },
    },
    controls: {
      canIn: zoom < LIMITS.zoomMax,
      canOut: zoom > LIMITS.zoomMin,
      onIn: () => zoomTo(zoom * LIMITS.zoomStep),
      onOut: () => zoomTo(zoom / LIMITS.zoomStep),
      onReset: () => zoomTo(LIMITS.zoomMin),
    },
  };
}

export type PanZoom = ReturnType<typeof usePanZoom>;
export type ZoomControls = PanZoom["controls"];
