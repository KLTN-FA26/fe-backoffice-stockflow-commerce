/**
 * Supplier — zod schemas + BR traceability.
 *
 * Nguồn: docs/01-product-master-data/supplier.
 * BE spec: code/name/email/phone/taxCode/status (ACTIVE/INACTIVE).
 */

import { z } from "zod";

import { SUPPLIER_STATUSES } from "@/constants";

/* ── Status enum ─────────────────────────────────────────────────────── */

export const supplierStatusValues = SUPPLIER_STATUSES;
export const supplierStatusSchema = z.enum(supplierStatusValues);

/* ── Address VN 3 cấp ───────────────────────────────────────────────── */

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
  name: z.string(),
  taxCode: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  address: addressVNSchema,
  paymentTerms: z.string(),
  currency: z.enum(["VND", "USD"]),
  leadTimeDays: z.number().int().min(0),
  rating: z.number().min(0).max(5),
  status: supplierStatusSchema,
  /**
   * Số PO chưa đóng của NCC này. BE (SCRUM-118) trả kèm khi GET detail để
   * UI cảnh báo trước khi vô hiệu hoá NCC còn đơn mở. Optional vì list
   * endpoint có thể không trả field này.
   */
  openPoCount: z.number().int().nonnegative().optional(),
});

/* ── Create input ────────────────────────────────────────────────────── */

export const supplierCreateInputSchema = z
  .object({
    name: z.string().min(1, "Tên nhà cung cấp không được để trống"),
    taxCode: z.string().min(1, "Mã số thuế không được để trống"),
    contactName: z.string().min(1, "Tên liên hệ không được để trống"),
    contactEmail: z.string().email("Email không hợp lệ"),
    contactPhone: z.string().min(1, "Số điện thoại không được để trống"),
    address: addressVNSchema,
    paymentTerms: z.string().min(1, "Điều khoản thanh toán không được để trống"),
    currency: z.enum(["VND", "USD"]),
    leadTimeDays: z.number().int().min(0, "Thời gian giao không âm"),
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
