/**
 * Fulfillment task — API layer, khớp BE `FulfillmentController` (`/fulfillment/tasks`, SCRUM-43).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây, map status BE → nhãn docs.
 * BE chưa có: dòng lấy hàng / quét / shortfall (start, completion không có body) và lọc danh sách
 * (chỉ `page` + `size`; phạm vi do BE quyết theo vai trò người gọi). Đóng gói (nhận đơn, kiện, quét,
 * hoàn tất) ở `packing-api.ts`.
 */

import { PACK_STATUS_BY_API, PAGE_SIZE, PICK_STATUS_BY_API } from "@/constants";
import { api } from "@/lib/api/client";

import {
  beArtifactAccessSchema,
  beFulfillmentTaskPageSchema,
  beFulfillmentTaskSchema,
} from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  ArtifactAccess,
  ArtifactUrlInput,
  AssignTaskInput,
  CreateTaskValues,
  FulfillmentTask,
  FulfillmentTaskApiDto,
  ReverifyTaskInput,
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
}

/**
 * BE trả theo vai trò: quản lý kho / điều phối thấy mọi task; QC chỉ thấy kiện đang giữ
 * (pack ON_HOLD); nhân viên kho chỉ thấy task gán cho mình. Mới nhất trước.
 */
export async function listFulfillmentTasks(
  params: ListFulfillmentTaskParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<FulfillmentTask>> {
  const { data } = await api.get<unknown>(TASKS_PATH, {
    params: { page: Math.max(0, params.page ?? 0), size: params.size ?? PAGE_SIZE.md },
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
 * Đưa đơn vào xuất kho và gán người lấy hàng. Đơn đã có task → BE trả task cũ nguyên trạng
 * (bỏ qua `assignedUserId` mới) — một đơn một task.
 */
export const createFulfillmentTask = (input: CreateTaskValues) =>
  postTask(TASKS_PATH, { orderId: input.orderId, assignedUserId: input.assignedUserId });

/** Gán lại — BE chỉ cho khi pick còn PENDING. */
export async function assignFulfillmentTask({
  taskId,
  assignedUserId,
}: AssignTaskInput): Promise<FulfillmentTask> {
  const { data } = await api.put<unknown>(`${taskPath(taskId)}/assignment`, { assignedUserId });
  return parseTask(data);
}

/* ── Lấy hàng / đóng gói ─────────────────────────────────────────────── */

export const startPicking = (taskId: string) => postTask(`${taskPath(taskId)}/picking-start`);

export const completePicking = (taskId: string) =>
  postTask(`${taskPath(taskId)}/picking-completion`);

/**
 * Kiểm tra lại kiện đang giữ (BE PR #136). Khớp → pack về `Packing` (KHÔNG phải `Packed`: người
 * đóng gói hoàn tất lại). Còn lệch → vẫn 200, pack vẫn `On Hold`, ghi chú không được lưu.
 */
export const reverifyDesignIntegrity = ({ taskId, resolutionNote }: ReverifyTaskInput) =>
  postTask(`${taskPath(taskId)}/design-integrity-reverification`, { resolutionNote });

/* ── Artifact thiết kế ───────────────────────────────────────────────── */

/** URL ký ngắn hạn tới file thiết kế đã khoá của một dòng đơn — không cache, không lưu lại. */
export async function getDesignArtifactUrl(
  { taskId, lineId, role }: ArtifactUrlInput,
  signal?: AbortSignal,
): Promise<ArtifactAccess> {
  const { data } = await api.get<unknown>(
    `${taskPath(taskId)}/lines/${encodeURIComponent(lineId)}/design-artifacts/${role}/download-url`,
    { signal },
  );
  return beArtifactAccessSchema.parse(data);
}
