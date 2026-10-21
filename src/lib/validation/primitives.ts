/**
 * Validation primitives — reusable zod schemas.
 *
 * These encode business rules (BR-xx) from module docs. Every schema that
 * enforces a BR must have a comment citing the source.
 */

import { z } from "zod";

/* ── Money ───────────────────────────────────────────────────────────── */

/** VND amount: non-negative integer. */
export const vnd = (msg = "Số tiền không hợp lệ") => z.number().int(msg).nonnegative(msg);

/** Generic non-negative money amount (allows decimals for USD). */
export const money = (msg = "Số tiền không hợp lệ") => z.number().nonnegative(msg);

/* ── Quantities ──────────────────────────────────────────────────────── */

/** Positive integer quantity (default for discrete items). */
export const intQty = (msg = "Số lượng phải > 0") => z.number().int(msg).positive(msg);

/** Positive number quantity (for weight-based UOM like kg). */
export const decimalQty = (msg = "Số lượng phải > 0") => z.number().positive(msg);

/* ── Dates ───────────────────────────────────────────────────────────── */

/** ISO date string: YYYY-MM-DD. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ (YYYY-MM-DD)");

/** ISO date that must be in the future. */
export const futureDate = isoDate.refine(
  (d) => new Date(d) > new Date(),
  "Ngày phải trong tương lai",
);

/** Expiry date must be after a given receive date — BR-06 (03). */
export const expiryAfter = (receiveDate: string) =>
  isoDate.refine((d) => d > receiveDate, "Hạn dùng phải sau ngày nhận"); // BR-06 (03-receipt)

/* ── Identifiers ─────────────────────────────────────────────────────── */

/**
 * Id kiểu `UUID` do BE cấp. Chỉ kiểm dạng 8-4-4-4-12 hex: `z.uuid()` của zod v4 còn kiểm
 * version/variant RFC 9562, trong khi Java `UUID` và Postgres `uuid` nhận mọi 128 bit — seed test
 * của BE (`md5('seed:' || key)::uuid`) và user hệ thống `md5('legacy:user:…')::uuid` sẽ bị từ chối
 * và làm hỏng cả trang. FE không được chặt hơn BE với id của chính BE.
 */
export const beUuid = z.guid();

/** Barcode: 4-64 chars. */
export const barcode = z.string().min(4, "Barcode quá ngắn").max(64, "Barcode quá dài");

/** Location code format: LOC-XX(X)-... */
export const locationCode = z
  .string()
  .regex(/^LOC-[A-Z]{2,3}-/, "Mã vị trí không hợp lệ (LOC-XX(X)-...)");

/** Non-empty trimmed string for required text fields. */
export const requiredString = (msg = "Trường bắt buộc") => z.string().trim().min(1, msg);

/* ── Currency ────────────────────────────────────────────────────────── */

export const currencySchema = z.enum(["VND", "USD", "CNY"]);

/* ── Email / Phone ───────────────────────────────────────────────────── */

export const email = z.string().email("Email không hợp lệ");

export const phone = z.string().regex(/^(\+84|0)\d{9,10}$/, "Số điện thoại không hợp lệ");

/**
 * Field DTO có thể null của BE. BE bật Jackson `default-property-inclusion: non_null`
 * (application.yml) — giá trị null bị BỎ khỏi JSON chứ không gửi `null`. Nhận cả thiếu lẫn null,
 * chuẩn hoá về `null`. Dùng cho mọi cột nullable thay vì `.nullable()` (sẽ vỡ khi field vắng).
 */
export const omittedOrNull = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);
