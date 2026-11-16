/**
 * Fulfillment task — zod DTO, khớp BE `FulfillmentController` (`/fulfillment/tasks`, SCRUM-43).
 *
 * BE bật Jackson `default-property-inclusion: non_null` → field null bị BỎ khỏi JSON, nên field
 * tuỳ chọn khai `.nullish()`. Input form + refine ở `input-schemas.ts` (api-conventions §3.1).
 */

import { z } from "zod";

import { PACK_API_STATUSES, PICK_API_STATUSES, PICK_DESTINATIONS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO: task ───────────────────────────────────────────────────────── */

/**
 * BE `FulfillmentTaskResponse.PaymentDue` — khoản đơn còn nợ trước khi bàn giao (G3-Q4): cảnh báo
 * sớm cho người đóng gói; bàn giao bị từ chối tới khi đơn được thanh toán.
 */
export const bePaymentDueSchema = z.object({
  amountDueBeforeHandover: z.number().nonnegative(),
  currency: z.string(),
});

/**
 * BE `FulfillmentTaskResponse.TaskLine` (SCRUM-466): dòng đơn đi kèm task — `lineId` là id dòng ĐƠN HÀNG
 * (tham số `{lineId}` của endpoint tải file thiết kế). Dòng in (`printLine`) có thiết kế đã khoá.
 */
export const beTaskLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  designSnapshotId: z.string().nullish(),
  printLine: z.boolean(),
});

/**
 * BE `FulfillmentTaskResponse` — `taskId` là id của pick; pick và pack 1-1 trên cùng task.
 * `destination` / `stagingLocationCode` / `stagedAt` / `movedToDispatchAt` (BE 4C-5, docs 07 §1): đích lấy hàng
 * DISPATCH hoặc STAGING (kèm khu chờ xuất của task), lúc mọi thùng về khu chờ xuất (`pickStatus` STAGED) và lúc
 * quản lý kho chuyển cả tác vụ sang khu xuất hàng. `.nullish()`: Jackson non_null bỏ field null.
 */
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
  destination: z.enum(PICK_DESTINATIONS).nullish(),
  stagingLocationCode: z.string().nullish(),
  stagedAt: z.string().nullish(),
  movedToDispatchAt: z.string().nullish(),
  // Chỉ có ở `GET /tasks/{id}` (BE `@JsonInclude(NON_NULL)`); danh sách và câu trả lời thao tác ghi không kèm
  lines: z.array(beTaskLineSchema).optional(),
  // Chỉ có ở câu trả lời của `packing-completion` (BE PR #136): lô giao vừa tạo + cảnh báo thu tiền
  shipmentId: z.string().nullish(),
  paymentDue: bePaymentDueSchema.nullish(),
});

export const beFulfillmentTaskPageSchema = bePageSchema(beFulfillmentTaskSchema);

/* ── DTO: dữ liệu phụ trợ của module khác ────────────────────────────── */

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
