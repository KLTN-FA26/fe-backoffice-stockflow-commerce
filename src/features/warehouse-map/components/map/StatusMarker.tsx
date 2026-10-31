"use client";

import { LOCATION_STATUS } from "@/constants";

import { LINE } from "./shape-utils";
import { locationTone, TONE_FILL } from "./tone";

/**
 * Chấm trạng thái ở góc trên-phải của kệ / khu vực — chỉ khi KHÔNG đang dùng (khoá, bảo trì, ngừng):
 * vị trí bình thường không cần dấu, bản đồ đỡ rối. Màu theo `effectiveStatus` (BR-16) như `<StatusDot>`.
 */
export function StatusMarker({ status, x, y }: { status: string; x: number; y: number }) {
  if (status === LOCATION_STATUS.ACTIVE) return null;
  return (
    <circle
      cx={x}
      cy={y}
      r={0.32}
      className={`${TONE_FILL[locationTone(status)]} stroke-bg-surface pointer-events-none`}
      strokeWidth={LINE.base}
    />
  );
}
