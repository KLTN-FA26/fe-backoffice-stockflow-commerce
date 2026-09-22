/**
 * Supplier — zod schemas + BR traceability.
 *
 * Nguồn: docs/warehouse/02-purchase-order (supplier master data phục vụ PO).
 * BE source: procurement.supplier (SCRUM-118) — columns: code / name / email / phone / taxCode / status (ACTIVE/INACTIVE).
 * FE-only giả định (chưa có ở BE, giữ để demo PO currency/lead-time — SCRUM-118 In Progress):
 *   address, paymentTerms, currency, leadTimeDays, rating — đánh dấu ASSUMPTION bên dưới.
 */

import { z } from "zod";

import { SUPPLIER_STATUSES } from "@/constants";
import { currencySchema, phone as phonePrimitive } from "@/lib/validation/primitives";

/* ── Status enum ─────────────────────────────────────────────────────── */

export const supplierStatusValues = SUPPLIER_STATUSES;
export const supplierStatusSchema = z.enum(supplierStatusValues);

/* ── Address VN 3 cấp (ASSUMPTION — FE-only, BE chưa trả; giữ để demo) ─ */

export const addressVNSchema = z.object({
  street: z.string(),
  ward: z.string(),
  district: z.string(),
  province: z.string(),
  postalCode: z.string(),
  country: z.literal("VN"),
});

/* ── DTO (response from backend) ────────────────────────────────────── */

export const supplierDtoSchema = z.object({
  supplierId: z.string(),
  // BE: code (procurement.supplier.code, UK). FE alias = supplierId trong mock; khi BE sẵn sàng, map code ↔ supplierId ở api layer.
  code: z.string().optional(),
  name: z.string(),
  taxCode: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  // ASSUMPTION (FE-only, BE chưa có): giữ optional để contract khớp BE gầy hơn khi tắt mock
  address: addressVNSchema.optional(),
  paymentTerms: z.string().optional(),
  // BR-07 (docs/warehouse/02-purchase-order §4 — PO currency cố định theo NCC): currency của PO lấy từ NCC
  currency: currencySchema.optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  status: supplierStatusSchema,
  /**
   * Số PO chưa đóng của NCC này. BE (SCRUM-118) trả kèm khi GET detail để
   * UI cảnh báo trước khi vô hiệu hoá NCC còn đơn mở. Optional vì list
   * endpoint có thể không trả field này.
   */
  openPoCount: z.number().int().nonnegative().optional(),
});

/** Paginated supplier list — parse tại biên (api-conventions §3.2). */
export const paginatedSupplierDtoSchema = z.object({
  items: z.array(supplierDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

// MST VN: 10 số (DN) hoặc 13 số (10 số + "-" + 3 số chi nhánh) — chuẩn Tổng cục Thuế
const taxCodeRegex = /^\d{10}(-\d{3})?$/;

/* ── Create input ────────────────────────────────────────────────────── */

export const supplierCreateInputSchema = z
  .object({
    // BE code (unique) — FE gửi kèm; nếu BE chưa nhận thì bỏ qua, không chặn
    code: z.string().trim().min(1, "Mã nhà cung cấp không được để trống").optional(),
    name: z.string().trim().min(1, "Tên nhà cung cấp không được để trống"),
    // BR: taxCode unique + đúng định dạng MST VN 10/13 số (SCRUM-389 yêu cầu inline duplicate)
    taxCode: z
      .string()
      .trim()
      .min(1, "Mã số thuế không được để trống")
      .regex(taxCodeRegex, "Mã số thuế phải 10 số (VD 0301234567) hoặc 13 số 0301234567-001"),
    contactName: z.string().trim().min(1, "Tên liên hệ không được để trống"),
    contactEmail: z.string().trim().email("Email không hợp lệ"),
    contactPhone: z
      .string()
      .trim()
      .min(1, "Số điện thoại không được để trống")
      .pipe(phonePrimitive),
    // FE-only — optional để khớp BE gầy
    address: addressVNSchema.optional(),
    paymentTerms: z.string().trim().min(1, "Điều khoản thanh toán không được để trống").optional(),
    currency: currencySchema.optional(),
    leadTimeDays: z.number().int().min(0, "Thời gian giao không âm").optional(),
  })
  .strict();

/* ── Update input ────────────────────────────────────────────────────── */

export const supplierUpdateInputSchema = supplierCreateInputSchema.partial().extend({
  id: z.string().min(1),
});

/* ── Toggle status ───────────────────────────────────────────────────── */

export const supplierToggleStatusSchema = z.object({
  id: z.string().min(1),
  status: supplierStatusSchema,
});
