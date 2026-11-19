/**
 * Shipping — bảng ánh xạ lý do giao thất bại của hãng (BE `FailureReasonMap`, docs 09 §4.1, E22): lý do 1-200 ký tự, không
 * trùng sau khi bỏ hoa thường / khoảng trắng thừa, tối đa 100 dòng. Pure — không gọi mạng.
 */

import { ORDER_DELIVERY_FAILURE_REASONS } from "@/constants";

import {
  REQUIRED,
  ROW_LIMITS as L,
  ROW_MESSAGES as MSG,
  isBlank,
  newRowKey,
} from "./carrier-row-core";

import type { RowErrors } from "./carrier-row-core";

export type FailureReasonCode = (typeof ORDER_DELIVERY_FAILURE_REASONS)[number];

export interface FailureReasonRow {
  key: string;
  wording: string;
  reason: FailureReasonCode | "";
}
type FailureField = "wording" | "reason";

const isFailureReason = (value: string): value is FailureReasonCode =>
  (ORDER_DELIVERY_FAILURE_REASONS as readonly string[]).includes(value);

export function failureReasonRowsFromMap(
  map: Readonly<Record<string, string>> | null | undefined,
): FailureReasonRow[] {
  return Object.entries(map ?? {}).map(([wording, reason]) => ({
    key: newRowKey(),
    wording,
    reason: isFailureReason(reason) ? reason : "",
  }));
}

/** Cùng cách BE so lý do của hãng: NFC, bỏ hoa thường, gộp khoảng trắng (kể cả khoảng trắng không ngắt). */
export function normaliseWording(wording: string): string {
  return wording
    .normalize("NFC")
    .trim()
    .replace(/[\s ]+/g, " ")
    .toLowerCase();
}

const failureStarted = (row: FailureReasonRow) => !(isBlank(row.wording) && row.reason === "");

export function validateFailureReasonRows(
  rows: readonly FailureReasonRow[],
): RowErrors<FailureField>[] {
  const seen = new Set<string>();
  const used = rows.filter(failureStarted).length;
  return rows.map((row) => {
    const errors: RowErrors<FailureField> = {};
    if (!failureStarted(row)) return errors;
    const wording = row.wording.trim();
    if (wording === "") errors.wording = REQUIRED;
    else if (wording.length > L.failureReasonWordingMax) errors.wording = MSG.tooLong;
    else {
      const key = normaliseWording(wording);
      if (seen.has(key)) errors.wording = MSG.wordingDuplicate;
      seen.add(key);
    }
    if (row.reason === "") errors.reason = REQUIRED;
    if (used > L.failureReasonMaxRows) errors.wording ??= MSG.tooManyRows(L.failureReasonMaxRows);
    return errors;
  });
}

/** Bảng gửi BE: lý do của hãng → mã nội bộ; dòng trống bỏ. Gọi sau khi `validateFailureReasonRows` không còn lỗi. */
export function failureReasonMapFromRows(
  rows: readonly FailureReasonRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (failureStarted(row) && row.reason !== "") map[row.wording.trim()] = row.reason;
  }
  return map;
}

export const failureReasonSignature = (rows: readonly FailureReasonRow[]): string =>
  JSON.stringify(
    rows
      .filter(failureStarted)
      .map((row) => [normaliseWording(row.wording), row.reason])
      .sort(),
  );
