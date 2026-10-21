/**
 * Lệnh sản xuất (LSX) — hợp đồng BE local integration d215f6e (ProductionOrderController,
 * ProductionMaterialIssueController, ProductionQcController, ProductionDashboardController,
 * SubcontractService; BE docs/handoffs/SCRUM-394-395.md + BE docs/handoffs/SPRINT2-WORKSHOP-PLAN.md). Jackson `non_null` → nullish.
 * Không có endpoint tạo LSX: LSX mẫu sinh khi gửi sản xuất yêu cầu mẫu, LSX đơn sinh khi release đơn.
 */

import { z } from "zod";

import {
  PRODUCTION_API_STATUSES,
  PRODUCTION_ORDER_MODES,
  PRODUCTION_ORDER_TYPES,
} from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";

export const HOLD_REASONS = [
  "FILE_REJECTED",
  "BLANKS_SHORT",
  "MACHINE_DOWN",
  "WAITING_CUSTOMER",
  "SUBCONTRACTOR_LATE",
  "OTHER",
] as const;
export const SCRAP_REASONS = [
  "PRINT_DEFECT",
  "DAMAGED_BLANK",
  "QC_FAILED",
  "SETUP",
  "OTHER",
] as const;
export const SUBCONTRACT_METHODS = ["SUPPLIED_BLANKS", "FULL_SERVICE"] as const;
export const PRODUCTION_ORIGINS = ["SPLIT", "SHORTFALL", "REPLACEMENT"] as const;

export const productionRowDtoSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  type: z.enum(PRODUCTION_ORDER_TYPES),
  mode: z.enum(PRODUCTION_ORDER_MODES),
  status: z.enum(PRODUCTION_API_STATUSES),
  holdReason: z.enum(HOLD_REASONS).nullish(),
  warehouseId: z.string(),
  blankSku: z.string(),
  designSnapshotId: z.string(),
  plannedQuantity: z.number().int(),
  goodQuantity: z.number().int(),
  dueDate: z.string().nullish(),
  sampleRequestId: z.string().nullish(),
  salesOrderId: z.string().nullish(),
  salesOrderLineId: z.string().nullish(),
  parentId: z.string().nullish(),
  createdAt: z.string(),
  /**
   * Khu PACKING nhận hàng của LSX đơn đã hoàn tất — bàn giao tự động khi QC hoàn tất (SCRUM-412, BE PR #109
   * V20261017000810). null trước khi hoàn tất, với LSX mẫu, hoặc LSX cũ không có dòng sổ kho để biết.
   */
  packingLocation: z.string().nullish(),
});
export const productionPageDtoSchema = bePageSchema(productionRowDtoSchema);

export const statusChangeDtoSchema = z.object({
  fromStatus: z.string().nullish(),
  toStatus: z.string(),
  reason: z.string().nullish(),
  changedAt: z.string(),
  changedBy: z.string().nullish(),
});

export const productionDetailDtoSchema = z.object({
  summary: productionRowDtoSchema,
  /** LSX đơn: mẫu khách đã duyệt dùng làm chuẩn QC (SCRUM-419). */
  approvedSampleId: z.string().nullish(),
  designChecksum: z.string(),
  issuedQuantity: z.number().int(),
  printedQuantity: z.number().int(),
  scrapQuantity: z.number().int(),
  prepressCheckedAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  version: z.number().int(),
  history: z.array(statusChangeDtoSchema),
  origin: z.enum(PRODUCTION_ORIGINS).nullish(),
  subcontract: z
    .object({
      method: z.enum(SUBCONTRACT_METHODS),
      subcontractorId: z.string(),
      unitPrice: z.number(),
      currency: z.string(),
      purchaseOrderId: z.string().nullish(),
    })
    .nullish(),
});

export const printFileDtoSchema = z.object({
  artifactId: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  checksum: z.string(),
  url: z.string(),
  expiresAt: z.string(),
});

export const materialIssueDtoSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  reservationId: z.string().nullish(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  fromLocation: z.string(),
  toLocation: z.string(),
  quantity: z.number().int(),
  issuedAt: z.string(),
});
export const materialIssueResultDtoSchema = z.object({
  issue: materialIssueDtoSchema,
  order: productionDetailDtoSchema,
});

export const qcRoundDtoSchema = z.object({
  id: z.string(),
  round: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  note: z.string().nullish(),
  inspectedAt: z.string(),
});

export const scrapDtoSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  reason: z.enum(SCRAP_REASONS),
  note: z.string().nullish(),
  recordedAt: z.string(),
});

export const dashboardDtoSchema = z.object({
  openByStatus: z.record(z.string(), z.number().int()),
  overdue: z.number().int(),
  printed: z.number().int(),
  scrap: z.number().int(),
  scrapRate: z.number().nullish(),
  samplesAwaitingApproval: z.number().int(),
  today: z.string(),
  periodBasis: z.string(),
  periodFrom: z.string().nullish(),
  periodTo: z.string().nullish(),
});
