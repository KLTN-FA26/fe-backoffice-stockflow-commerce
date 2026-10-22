/**
 * Chụp ảnh 3D cho phiếu in (PR F6) theo từng nhịp để trang kịp vẽ thanh tiến độ. `captureStepImages` (capture.ts) chạy
 * đồng bộ và cộng dồn kiện qua từng bước, nên cả chục bước làm trình duyệt đứng hình; ở đây chia các bước thành lô nhỏ,
 * nhường luồng giữa các lô. Lô thứ hai trở đi mở đầu bằng MỘT "bước" chứa mọi kiện của các lô trước (ảnh của nó bị bỏ)
 * để cảnh cộng dồn vẫn đúng.
 */

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { captureStepImages, captureVehicleViews } from "./capture";

import type { CapturedView, ColorOf, LabelOf } from "./capture";
import type { LoadingStep } from "./loading-steps";
import type { Layout, LayoutBox } from "../types";

export interface PrintImages {
  left: CapturedView;
  right: CapturedView;
  /** Ảnh cộng dồn sau từng bước, cùng thứ tự `steps`. */
  steps: string[];
}

export interface CaptureControl {
  /** Đặt true khi người dùng rời trang: dừng ở ranh giới lô kế tiếp. */
  cancelled: boolean;
}

const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Ném `CaptureCancelled` nếu bị huỷ giữa chừng. */
export class CaptureCancelled extends Error {}

export async function capturePrintImages(
  layout: Layout,
  steps: readonly Pick<LoadingStep, "boxes">[],
  colorOf: ColorOf,
  labelOf: LabelOf,
  onProgress: (done: number, total: number) => void,
  control: CaptureControl = { cancelled: false },
): Promise<PrintImages> {
  const total = steps.length + 1;
  const check = () => {
    if (control.cancelled) throw new CaptureCancelled();
  };
  onProgress(0, total);
  await nextTick();
  check();
  const { left, right } = captureVehicleViews(layout, colorOf, labelOf);
  let done = 1;
  onProgress(done, total);

  const images: string[] = [];
  const loaded: LayoutBox[] = [];
  for (let start = 0; start < steps.length; start += LOAD_PLANNING_LIMITS.captureChunkSteps) {
    await nextTick();
    check();
    const chunk = steps
      .slice(start, start + LOAD_PLANNING_LIMITS.captureChunkSteps)
      .map((step) => step.boxes);
    const withBase = start === 0 ? chunk : [[...loaded], ...chunk];
    const shot = captureStepImages(layout, withBase, colorOf, labelOf);
    images.push(...(start === 0 ? shot : shot.slice(1)));
    for (const boxes of chunk) loaded.push(...boxes);
    done += chunk.length;
    onProgress(done, total);
  }
  return { left, right, steps: images };
}
