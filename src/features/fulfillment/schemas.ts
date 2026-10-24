/**
 * Fulfillment task — zod DTO, khớp BE `FulfillmentController` (`/fulfillment/tasks`, SCRUM-43).
 *
 * BE bật Jackson `default-property-inclusion: non_null` → field null bị BỎ khỏi JSON, nên field
 * tuỳ chọn khai `.nullish()`. Input form + refine ở `input-schemas.ts` (api-conventions §3.1).
 */

import { z } from "zod";

import { DESIGN_ARTIFACT_ROLES, PACK_API_STATUSES, PICK_API_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { isSafeArtifactUrl } from "./selectors";

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

/**
 * BE `FulfillmentTaskResponse.PaymentDue` — khoản đơn còn nợ trước khi bàn giao (G3-Q4): cảnh báo
 * sớm cho người đóng gói; bàn giao bị từ chối tới khi đơn được thanh toán.
 */
export const bePaymentDueSchema = z.object({
  amountDueBeforeHandover: z.number().nonnegative(),
  currency: z.string(),
});

/** BE `FulfillmentTaskResponse` — `taskId` là id của pick; pick và pack 1-1 trên cùng task. */
export const beFulfillmentTaskSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  // BE PR #136 trả thêm số đơn / kho / tên người được gán
  orderNumber: z.string().nullish(),
  warehouseId: z.string().nullish(),
  assignedUserName: z.string().nullish(),
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
  // Chỉ có ở câu trả lời của `packing-completion` (BE PR #136): lô giao vừa tạo + cảnh báo thu tiền
  shipmentId: z.string().nullish(),
  paymentDue: bePaymentDueSchema.nullish(),
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
  // Chỉ nhận URL tuyệt đối http(s) — URL này được gán vào `tab.location.href` / `<img src>`
  url: z.string().refine(isSafeArtifactUrl, { message: "URL file thiết kế không hợp lệ" }),
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
  /**
   * Hàng in đã về bàn đóng gói (BE PR #150, PACK-EARLY): false khi đơn còn đang in, hoặc đã giao hàng có
   * sẵn trước khi sản xuất xong. Vắng = BE không trả.
   */
  printLinesReady: z.boolean().nullish(),
});

export const fulfillmentOrderPageSchema = bePageSchema(fulfillmentOrderSchema);

/**
 * BE `TaskCandidateResponse` (`GET /fulfillment/task-candidates`, guard
 * `fulfillment-task-assignment:CREATE`, BE PR #151): đơn đã release (READY_TO_FULFILL) chưa có task,
 * cũ nhất trước. Thay cho `GET /orders` (cần `sales-orders:READ`, quản lý kho không có). Một dòng
 * `printed` là dòng in tuỳ chỉnh (BR-06 — đã release sản xuất mới vào được danh sách này).
 */
export const taskCandidateLineSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  printed: z.boolean(),
});

export const taskCandidateSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  customerName: z.string().nullish(),
  warehouseId: z.string(),
  placedAt: z.string().nullish(),
  releasedAt: z.string().nullish(),
  lineCount: z.number().int().min(0),
  totalQuantity: z.number().int().min(0),
  lines: z.array(taskCandidateLineSchema).default([]),
});

export const taskCandidatePageSchema = bePageSchema(taskCandidateSchema);

/**
 * BE `AssigneeResponse` (`GET /fulfillment/assignees?warehouseId=`, guard
 * `fulfillment-task-assignment:UPDATE`): người nhận được task của một kho — chỉ tên và vai trò, BE đã lọc
 * nhân viên đang hoạt động được gán cho kho đó (`requireWarehouseAssignee`).
 */
export const assigneeSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullish(),
  roles: z.array(z.string()).default([]),
});

export const assigneeListSchema = z.array(assigneeSchema);
