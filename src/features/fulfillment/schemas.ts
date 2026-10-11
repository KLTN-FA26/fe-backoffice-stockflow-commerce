/**
 * Fulfillment task — zod DTO, khớp BE `FulfillmentController` (`/fulfillment/tasks`, SCRUM-43).
 *
 * BE bật Jackson `default-property-inclusion: non_null` → field null bị BỎ khỏi JSON, nên field
 * tuỳ chọn khai `.nullish()`. Input form + refine ở `input-schemas.ts` (api-conventions §3.1).
 */

import { z } from "zod";

import { DESIGN_ARTIFACT_ROLES, PACK_API_STATUSES, PICK_API_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO: task ───────────────────────────────────────────────────────── */

/**
 * BE `FulfillmentTaskResponse.IntegrityEvidence` — một lần đối chiếu checksum của một dòng đơn.
 * Append-only: mỗi lần đóng gói / kiểm tra lại thêm một bản ghi cho mỗi dòng có thiết kế.
 */
export const beIntegrityEvidenceSchema = z.object({
  orderLineId: z.string(),
  snapshotId: z.string(),
  expectedChecksum: z.string(),
  actualChecksum: z.string(),
  matching: z.boolean(),
  verifiedAt: z.string(),
});

/** BE `FulfillmentTaskResponse` — `taskId` là id của pick; pick và pack 1-1 trên cùng task. */
export const beFulfillmentTaskSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  // API luôn gán khi tạo (CreateTaskRequest @NotNull), cột DB cho phép null
  assignedUserId: z.string().nullish(),
  pickStatus: z.enum(PICK_API_STATUSES),
  packStatus: z.enum(PACK_API_STATUSES),
  assignedAt: z.string().nullish(),
  startedAt: z.string().nullish(),
  pickedAt: z.string().nullish(),
  packedAt: z.string().nullish(),
  // Mới nhất trước (BE `findByPackIdOrderByVerifiedAtDesc`)
  integrityEvidence: z.array(beIntegrityEvidenceSchema).default([]),
});

export const beFulfillmentTaskPageSchema = bePageSchema(beFulfillmentTaskSchema);

/** BE `FulfillmentArtifactAccessResponse` — URL ký ngắn hạn, trả kèm `Cache-Control: no-store`. */
export const beArtifactAccessSchema = z.object({
  artifactId: z.string(),
  role: z.enum(DESIGN_ARTIFACT_ROLES),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().min(0),
  checksum: z.string(),
  url: z.string(),
  expiresAt: z.string(),
});

/* ── DTO: dữ liệu phụ trợ của module khác ────────────────────────────── */

/**
 * Phần `OrderResponse` (BE OrderController) mà màn xuất kho cần: số đơn và dòng đơn. Task không
 * kèm dòng nào, và `lineId` ở đây chính là `{lineId}` của endpoint tải artifact.
 * Chỉ giữ field dùng tới — feature này KHÔNG import `features/order` (import boundary).
 */
export const fulfillmentOrderLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  // Có giá trị = dòng tuỳ chỉnh, thiết kế đã khoá (SHA-256 của toàn bundle)
  designSnapshotId: z.string().nullish(),
  designChecksum: z.string().nullish(),
});

export const fulfillmentOrderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  // null tới khi đơn được release (SCRUM-423)
  warehouseId: z.string().nullish(),
  lines: z.array(fulfillmentOrderLineSchema).default([]),
});

export const fulfillmentOrderPageSchema = bePageSchema(fulfillmentOrderSchema);

/** Phần `UserResponse` (BE UserManagementController) cần để chọn / hiện tên người được gán. */
export const assignableUserSchema = z.object({
  userId: z.string(),
  username: z.string().nullish(),
  fullName: z.string().nullish(),
  roles: z.array(z.string()).default([]),
});

export const assignableUserPageSchema = bePageSchema(assignableUserSchema);
