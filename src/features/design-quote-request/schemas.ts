/**
 * Yêu cầu báo giá thiết kế — BE origin/develop 5fe7b9a16 (`DesignQuoteRequestResponse.java:13-16`,
 * `DesignProjectQuoteRequestResponse.java:14-21`). Jackson `non_null` → trường null bị bỏ → `omittedOrNull`.
 */

import { z } from "zod";

import { DESIGN_STATUSES } from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

export const QUOTE_REQUEST_STATUSES = ["OPEN", "CLOSED"] as const;
const requestStatusSchema = z.enum(QUOTE_REQUEST_STATUSES);

export const designQuoteRequestDtoSchema = z.object({
  id: z.string(),
  designId: z.string(),
  designName: z.string(),
  designStatus: z.enum(DESIGN_STATUSES),
  customerId: z.string(),
  customerName: omittedOrNull(z.string()),
  /** SKU phôi. */
  sku: z.string(),
  /** SKU riêng — chỉ khi thiết kế APPROVED. */
  customerSku: omittedOrNull(z.string()),
  returnReason: omittedOrNull(z.string()),
  cartons: z.number().int(),
  desiredDeliveryDate: omittedOrNull(z.string()),
  status: requestStatusSchema,
  requestedBy: z.string(),
  requestedAt: z.string(),
  closedAt: omittedOrNull(z.string()),
  /** Vắng khi đóng vì khách xoá nháp. */
  closedBy: omittedOrNull(z.string()),
});
export const designQuoteRequestPageSchema = bePageSchema(designQuoteRequestDtoSchema);

export const projectQuoteRequestLineSchema = z.object({
  designId: z.string(),
  designName: z.string(),
  designStatus: z.enum(DESIGN_STATUSES),
  customerSku: omittedOrNull(z.string()),
  cartons: z.number().int(),
});

export const projectQuoteRequestDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  customerId: z.string(),
  customerName: omittedOrNull(z.string()),
  desiredDeliveryDate: omittedOrNull(z.string()),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: requestStatusSchema,
  closedAt: omittedOrNull(z.string()),
  closedBy: omittedOrNull(z.string()),
  lines: z.array(projectQuoteRequestLineSchema).default([]),
});
export const projectQuoteRequestPageSchema = bePageSchema(projectQuoteRequestDtoSchema);

/** Báo giá nháp BE trả sau `…/quote` (cùng dạng `GET /quotes/{id}`); chỉ `id` cần ở đây, các trường khác bỏ qua. */
export const createdQuoteSchema = z.object({ id: z.string() });
