/**
 * Shipping (module 09) — zod DTO chuyến xe theo CONTRACT ĐỀ XUẤT cho BE SCRUM-288.
 *
 * ASSUMPTION: chờ BE SCRUM-288. BE develop chưa có entity / endpoint load, manifest — hình dạng
 * dưới đây dựng từ BE business-design 03-state-machines §11 + 04c F-SHP (bảng `load`, `load_line`
 * `loaded_at`, `manifest`). Khi BE lên: khớp lại field ở đây + `api.ts` + mock, không sửa component.
 * Không có `trackingNumber` / `awb`: hãng là bên thứ ba (rescope 2026-10-06).
 */

import { z } from "zod";

import { LOAD_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

export const loadStatusSchema = z.enum(LOAD_STATUSES);

/** Kiện thuộc chuyến (`load_line`) — `loadedAt` có giá trị khi đã quét lên xe (F-SHP bước 04). */
export const beLoadLineSchema = z.object({
  loadLineId: z.string(),
  packageId: z.string(),
  packageCode: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  weightKg: z.number().nonnegative().nullish(),
  loadedAt: z.iso.datetime({ offset: true }).nullish(),
  loadedBy: z.string().nullish(),
});

/** Biên bản bàn giao (`manifest`) — có khi chuyến đã DISPATCHED (F-SHP bước 05). */
export const beManifestSchema = z.object({
  manifestNumber: z.string(),
  carrierRepresentative: z.string(),
  note: z.string().nullish(),
  handedOverBy: z.string().nullish(),
  handedOverAt: z.iso.datetime({ offset: true }),
});

const loadHeaderShape = {
  loadId: z.string(),
  number: z.string(),
  warehouseId: z.string(),
  status: loadStatusSchema,
  // Xe đặt ngoài hệ thống (SCRUM-287): chỉ ghi nhận biển số / loại xe / hãng
  vehiclePlate: z.string().nullish(),
  vehicleType: z.string().nullish(),
  carrierName: z.string().nullish(),
  plannedPackages: z.number().int().min(0),
  loadedPackages: z.number().int().min(0),
  bookedAt: z.iso.datetime({ offset: true }).nullish(),
  dispatchedAt: z.iso.datetime({ offset: true }).nullish(),
};

export const beLoadRowSchema = z.object(loadHeaderShape);

export const beLoadSchema = z.object({
  ...loadHeaderShape,
  lines: z.array(beLoadLineSchema).default([]),
  manifest: beManifestSchema.nullish(),
  version: z.number().int(),
});

export const beLoadPageSchema = bePageSchema(beLoadRowSchema);
