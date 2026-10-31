/**
 * Màu trạng thái trên bản đồ — tô theo `effectiveStatus` (BE: "Colour by effectiveStatus, not status").
 * Tone lấy từ `status-map` như `<StatusDot>`; class sinh từ token `--dot-*` / status gốc, không hex.
 */

import { toneOf } from "@/lib/status-map";

import type { SemanticTone } from "@/lib/mock-data";

/** Viền + chấm theo tone (thang `--dot-*` cho chấm / viền mảnh như toolbar). */
export const TONE_STROKE: Record<SemanticTone, string> = {
  positive: "stroke-dot-positive",
  info: "stroke-dot-info",
  warning: "stroke-dot-warning",
  danger: "stroke-dot-danger",
  special: "stroke-dot-special",
  neutral: "stroke-neutral",
  muted: "stroke-muted-tone",
};

export const TONE_FILL: Record<SemanticTone, string> = {
  positive: "fill-dot-positive",
  info: "fill-dot-info",
  warning: "fill-dot-warning",
  danger: "fill-dot-danger",
  special: "fill-dot-special",
  neutral: "fill-neutral",
  muted: "fill-muted-tone",
};

/** Biến CSS của tone — 3D đọc giá trị lúc chạy (three.js không hiểu class Tailwind). */
export const TONE_VAR: Record<SemanticTone, string> = {
  positive: "--dot-positive",
  info: "--dot-info",
  warning: "--dot-warning",
  danger: "--dot-danger",
  special: "--dot-special",
  neutral: "--neutral",
  muted: "--neutral",
};

export const locationTone = (status: string): SemanticTone => toneOf(status);
