/**
 * Fulfillment task — API layer, khớp BE `FulfillmentController` (`/fulfillment/tasks`, SCRUM-43).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây, map status BE → nhãn docs.
 * Danh sách lọc được theo trạng thái pick / kho / người được gán (SCRUM-466). Đóng gói (nhận đơn, kiện,
 * quét, hoàn tất) ở `packing-api.ts`.
 */

import { PACK_STATUS_BY_API, PAGE_SIZE, PICK_DESTINATION, PICK_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";

import { beFulfillmentTaskPageSchema, beFulfillmentTaskSchema } from "./schemas";

import type { PickApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  AssignTaskInput,
  CreateTaskValues,
  FulfillmentTask,
  FulfillmentTaskApiDto,
} from "./types";

const TASKS_PATH = "/fulfillment/tasks";

const taskPath = (taskId: string) => `${TASKS_PATH}/${encodeURIComponent(taskId)}`;

export function toFulfillmentTask(dto: FulfillmentTaskApiDto): FulfillmentTask {
  return {
    ...dto,
    pickStatus: PICK_STATUS_BY_API[dto.pickStatus],
    packStatus: PACK_STATUS_BY_API[dto.packStatus],
  };
}

function parseTask(data: unknown): FulfillmentTask {
  return toFulfillmentTask(beFulfillmentTaskSchema.parse(data));
}

async function postTask(path: string, body?: unknown): Promise<FulfillmentTask> {
  const { data } = await api.post<unknown>(path, body);
  return parseTask(data);
}

/* ── List / detail ───────────────────────────────────────────────────── */

export interface ListFulfillmentTaskParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  /** BE `Pages`: mặc định 20, tối đa 200; ngoài khoảng → 400 (không tự kẹp). */
  size?: number;
  /** Một trạng thái pick (BE `parseStatus`); giá trị lạ → 400 `UNSUPPORTED_PARAMETER`. */
  status?: PickApiStatus;
  /** Kho ngoài phạm vi người gọi → 403 `OUT_OF_DATA_SCOPE` (SCRUM-466). */
  warehouseId?: string;
  assignedUserId?: string;
}

/**
 * Phạm vi theo mã quyền (BE `listTasks`): task-oversight:READ thấy mọi task; design-reverification:READ
 * chỉ kiện đang giữ; còn lại chỉ task gán cho mình. Lọc chỉ thu hẹp trong phạm vi đó. Mới nhất trước.
 */
export async function listFulfillmentTasks(
  params: ListFulfillmentTaskParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<FulfillmentTask>> {
  const { data } = await api.get<unknown>(TASKS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      // Chỉ gửi tham số đang lọc — BE coi chuỗi rỗng là giá trị (400 / không khớp)
      ...(params.status ? { status: params.status } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.assignedUserId ? { assignedUserId: params.assignedUserId } : {}),
    },
    signal,
  });
  const page = beFulfillmentTaskPageSchema.parse(data);
  return { ...page, items: page.items.map(toFulfillmentTask) };
}

/** Người không được gán (và không phải quản lý / QC / điều phối) nhận 404, không phải 403. */
export async function getFulfillmentTask(
  taskId: string,
  signal?: AbortSignal,
): Promise<FulfillmentTask> {
  const { data } = await api.get<unknown>(taskPath(taskId), { signal });
  return parseTask(data);
}

/* ── Tạo / gán ───────────────────────────────────────────────────────── */

/**
 * Đưa đơn vào xuất kho, chọn đích lấy hàng và gán người lấy (`{orderId, assignedUserId, destination,
 * stagingLocationCode?}`, docs 07 §4.1 bước 2). Đích STAGING kèm khu chờ xuất của kho (bỏ được khi kho có đúng một);
 * đích DISPATCH không gửi khu chờ xuất. Đơn đã có task → BE trả task cũ nguyên trạng (bỏ qua người / đích mới) — một
 * đơn (một đợt giao) một task.
 */
export const createFulfillmentTask = ({
  orderId,
  assignedUserId,
  destination = PICK_DESTINATION.DISPATCH,
  stagingLocationCode,
}: CreateTaskValues) =>
  postTask(TASKS_PATH, {
    orderId,
    assignedUserId,
    destination,
    ...(destination === PICK_DESTINATION.STAGING && stagingLocationCode
      ? { stagingLocationCode }
      : {}),
  });

/** Gán lại — BE chỉ cho khi pick còn PENDING. */
export async function assignFulfillmentTask({
  taskId,
  assignedUserId,
}: AssignTaskInput): Promise<FulfillmentTask> {
  const { data } = await api.put<unknown>(`${taskPath(taskId)}/assignment`, { assignedUserId });
  return parseTask(data);
}

/* ── Lấy hàng ────────────────────────────────────────────────────────── */

export const startPicking = (taskId: string) => postTask(`${taskPath(taskId)}/picking-start`);

export const completePicking = (taskId: string) =>
  postTask(`${taskPath(taskId)}/picking-completion`);

/**
 * Chuyển CẢ tác vụ `Staged` sang khu xuất hàng (BE `POST /tasks/{id}/dispatch-transfer`, docs 07 §4.3 bước 8, BR-11):
 * mọi thùng ở khu chờ xuất bị trừ tồn tại chỗ, task → `Picked`. Quyết định của quản lý kho
 * (`fulfillment-task-assignment:UPDATE`), không cần là người được gán. Task không `Staged` → 409
 * PICK_TASK_STATE_CONFLICT; đơn đang treo → 409 PICK_ORDER_ON_HOLD (thùng ở lại khu chờ xuất). Gọi lại → 200 như cũ.
 */
export const moveToDispatch = (taskId: string) => postTask(`${taskPath(taskId)}/dispatch-transfer`);
