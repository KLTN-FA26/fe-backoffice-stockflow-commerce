"use client";

import { useEffect, useState } from "react";

import { buildLoadingSteps } from "../../lib/loading-steps";
import { disposeSharedRenderer } from "../../lib/capture-renderer";
import { CaptureCancelled, capturePrintImages } from "../../lib/print-capture";
import { letterMapOf } from "../../lib/print-labels";
import { colorOf } from "../../lib/palette";

import type { ColorMap } from "../../lib/palette";
import type { PrintImages } from "../../lib/print-capture";
import type { Layout } from "../../types";

export type PrintImageState =
  | { status: "capturing"; done: number; total: number }
  | { status: "ready"; images: PrintImages }
  | { status: "error" };

/** Trước nhịp đầu tiên của `capturePrintImages` (nó báo 0/total ngay khi bắt đầu, kể cả khi thử lại). */
const CAPTURING: PrintImageState = { status: "capturing", done: 0, total: 1 };

/**
 * Chụp ảnh 3D của một xe cho phiếu in. Chụp lại khi bố cục xe đổi (react-query giữ nguyên tham chiếu khi dữ liệu không
 * đổi, nên tải lại nền không chụp lại), hoặc khi người dùng bấm "Thử lại". Lỗi (không có WebGL…) → `error`, trang vẫn
 * cho xem phiếu không có ảnh. Nhả renderer dùng chung khi rời trang.
 */
export function usePrintImages(
  layout: Layout | undefined,
  allLayouts: readonly Layout[] | undefined,
  colorMap: ColorMap,
): { state: PrintImageState; retry: () => void } {
  const [state, setState] = useState<PrintImageState>(CAPTURING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => disposeSharedRenderer, []);

  useEffect(() => {
    if (!layout || !allLayouts) return;
    const control = { cancelled: false };
    const letters = letterMapOf(allLayouts.flatMap((l) => l.boxes));
    capturePrintImages(
      layout,
      buildLoadingSteps([layout]),
      (box) => colorOf(colorMap, box.partName),
      (box) => letters.get(box.partName) ?? "",
      (done, total) => {
        if (!control.cancelled) setState({ status: "capturing", done, total });
      },
      control,
    )
      .then((images) => {
        if (!control.cancelled) setState({ status: "ready", images });
      })
      .catch((error: unknown) => {
        if (!(error instanceof CaptureCancelled) && !control.cancelled)
          setState({ status: "error" });
      });
    return () => {
      control.cancelled = true;
    };
  }, [layout, allLayouts, colorMap, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
