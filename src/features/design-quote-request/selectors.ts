/**
 * Selector thuần của hộp yêu cầu báo giá — không React, không gọi API.
 */

import { QUOTE_REQUEST_WAIT_HOURS } from "@/constants/numbers";

import type { QuoteRequest } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type WaitLevel = "normal" | "warn" | "long";

export interface Waiting {
  /** "Đã chờ 2 ngày", "Đã chờ 3 giờ", "Đã chờ 5 phút", "Vừa gửi". */
  label: string;
  level: WaitLevel;
}

/**
 * Yêu cầu đang mở đã chờ Sale bao lâu, tính từ `requestedAt` (BE trả) — để Sale biết yêu cầu nào làm trước (bo-01).
 * Yêu cầu đã đóng thì không còn chờ → `null`.
 */
export function waitingOf(
  row: Pick<QuoteRequest, "status" | "requestedAt">,
  now: Date,
): Waiting | null {
  if (row.status !== "OPEN") return null;
  const waited = Math.max(0, now.getTime() - new Date(row.requestedAt).getTime());
  if (!Number.isFinite(waited)) return null;
  const level: WaitLevel =
    waited >= QUOTE_REQUEST_WAIT_HOURS.long * HOUR
      ? "long"
      : waited >= QUOTE_REQUEST_WAIT_HOURS.warn * HOUR
        ? "warn"
        : "normal";
  const label =
    waited >= DAY
      ? `Đã chờ ${Math.floor(waited / DAY)} ngày`
      : waited >= HOUR
        ? `Đã chờ ${Math.floor(waited / HOUR)} giờ`
        : waited >= MINUTE
          ? `Đã chờ ${Math.floor(waited / MINUTE)} phút`
          : "Vừa gửi";
  return { label, level };
}
