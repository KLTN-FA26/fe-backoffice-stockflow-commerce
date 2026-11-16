/**
 * Mock dòng lấy hàng — store in-memory + helper cho `mock-routes-pick-lines.ts`.
 * Wire shape = BE `PickLineResponse` (docs 07 §4.2): MỖI DÒNG LÀ MỘT THÙNG LPN (BR-04) — dòng hàng của đơn mock được
 * tách thành một dòng cho mỗi thùng, bin lấy hàng từ bin mock của kho task, `allocatedQty` = số cái chuẩn / thùng.
 * Chỉ dùng khi USE_MOCK=true.
 */

import { backendOrderStatusOf, fakeSha256 } from "./mock-routes-orders";
import { beError } from "./mock-routes-purchase-orders-store";
import { mockPickableBinCodes } from "./mock-routes-warehouse-layout";

import type { AxiosRequestConfig } from "axios";
import type { MockResponse } from "./mock-adapter";
import type { MockTask } from "./mock-routes-fulfillment-store";

export type MockPickLineStatus = "OPEN" | "STAGED" | "PICKED" | "SHORT" | "CANCELLED" | "PUT_BACK";
export type MockShortReason = "NOT_FOUND" | "DAMAGED";

export interface MockPickLine {
  lineId: string;
  taskId: string;
  sequenceNo: number;
  orderLineId: string;
  sku: string;
  barcode?: string;
  locationCode: string;
  lotNumber?: string;
  allocatedQty: number;
  pickedQty: number;
  status: MockPickLineStatus;
  pickedAt?: string;
  putBackQty: number;
  putBackLocationCode?: string;
  putBackAt?: string;
  shortQty: number;
  shortReason?: MockShortReason;
  /** Mã thùng — phải quét để xác nhận dòng (BR-10) và để cất lại. */
  lpn: string;
  wholeCarton: boolean;
  stagedAt?: string;
  stagedLocationCode?: string;
}

const linesByTask = new Map<string, MockPickLine[]>();
const idempotent = new Map<string, { body: string; response: MockResponse }>();

export function resetPickLineMockStore(): void {
  linesByTask.clear();
  idempotent.clear();
}

function uuidOf(seed: string): string {
  const hex = fakeSha256(seed);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Số cái chuẩn / thùng của mock (docs 01 BR-11: mọi thùng của một SKU cùng số cái). */
const MOCK_UNITS_PER_CARTON = 10;

/** LPN mock ổn định theo (task, dòng đơn, thùng thứ n) — chữ hoa + số, ≤ 30 ký tự như `@Size(max = 30)`. */
const lpnOf = (taskId: string, orderLineId: string, carton: number, suffix = "") =>
  `LPN${fakeSha256(`lpn:${taskId}:${orderLineId}:${carton}${suffix}`).slice(0, 10).toUpperCase()}`;

/**
 * BE `planLines`: một dòng cho MỖI THÙNG đã phân bổ của đơn, ở bin của kho task, xếp theo mã vị trí rồi SKU (docs 07
 * §4.1 bước 2). ASSUMPTION (mock-only): số thùng của dòng đơn = ceil(SL / 10), thùng nằm lần lượt ở các bin lấy được.
 */
async function plan(task: MockTask): Promise<MockPickLine[]> {
  const { orders, skus } = await import("@/lib/mock-data");
  const order = orders.find((candidate) => candidate.orderId === task.orderId);
  if (!order) return [];
  const bins = await mockPickableBinCodes(task.warehouseId);
  let index = 0;
  return order.lines
    .filter((line) => !line.designId)
    .flatMap((line) =>
      Array.from(
        { length: Math.max(1, Math.ceil(line.quantity / MOCK_UNITS_PER_CARTON)) },
        (_, carton) => {
          const next = index++;
          return {
            lineId: uuidOf(`pick-line:${task.taskId}:${line.lineId}:${carton}`),
            taskId: task.taskId,
            sequenceNo: 0,
            orderLineId: line.lineId,
            sku: line.skuId,
            barcode: skus.find((sku) => sku.skuId === line.skuId)?.barcode,
            locationCode: bins[next % Math.max(bins.length, 1)] ?? "UNKNOWN",
            allocatedQty: MOCK_UNITS_PER_CARTON,
            pickedQty: 0,
            status: "OPEN" as const,
            putBackQty: 0,
            shortQty: 0,
            lpn: lpnOf(task.taskId, line.lineId, carton),
            wholeCarton: true,
          };
        },
      ),
    )
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode) || a.sku.localeCompare(b.sku))
    .map((line, position) => ({ ...line, sequenceNo: position + 1 }));
}

/**
 * BE `PickList.confirm` — hợp lệ → tuỳ đích của task: DISPATCH → PICKED (trừ tồn ngay); STAGING → STAGED (thùng về khu
 * chờ xuất, chưa trừ tồn).
 */
export function markPicked(line: MockPickLine, at: string, stagingLocationCode?: string): void {
  line.pickedQty = line.allocatedQty;
  line.pickedAt = at;
  if (stagingLocationCode) {
    line.status = "STAGED";
    line.stagedAt = at;
    line.stagedLocationCode = stagingLocationCode;
  } else {
    line.status = "PICKED";
  }
}

/**
 * Dòng của task; lần đầu thì lập kế hoạch. Task seed ở trạng thái giữa chừng có dòng tương ứng:
 * PICKING → dòng đầu đã lấy; PICKED / STAGED → mọi dòng; CANCELLED (huỷ sau khi lấy) → dòng đầu đã lấy, còn
 * lại huỷ. Task mới (PENDING) → mọi dòng OPEN.
 */
export async function getMockPickLines(task: MockTask): Promise<MockPickLine[]> {
  const stored = linesByTask.get(task.taskId);
  if (stored) return stored;
  const lines = await plan(task);
  const at = task.startedAt ?? task.assignedAt;
  lines.forEach((line, index) => {
    if (task.pickStatus === "STAGED") {
      markPicked(line, at, task.stagingLocationCode);
    } else if (task.pickStatus === "PICKED" || (index === 0 && task.pickStatus !== "PENDING")) {
      markPicked(line, at);
    } else if (task.pickStatus === "CANCELLED") {
      line.status = "CANCELLED";
    }
  });
  linesByTask.set(task.taskId, lines);
  return lines;
}

/** BE `PickList.reportShort`: dòng → SHORT cả thùng, ghi lý do; không trừ / không chuyển tồn. */
export function reportMockShort(line: MockPickLine, reason: MockShortReason): void {
  line.status = "SHORT";
  line.shortQty = line.allocatedQty;
  line.shortReason = reason;
}

/**
 * BE `reallocateShort` (docs 07 §4.4 bước 10): chọn thùng KHÁC (nguyên thùng) ở bin khác của kho, không lấy lại thùng
 * vừa thiếu. Dòng thiếu → CANCELLED (giữ `shortQty`), thêm một dòng OPEN. ASSUMPTION (mock-only): bin còn lại nào cũng
 * có thùng; hết bin → `null` (route trả 409 INSUFFICIENT_STOCK).
 */
export async function reallocateMockShort(
  task: MockTask,
  line: MockPickLine,
): Promise<MockPickLine[] | null> {
  const lines = await getMockPickLines(task);
  const exhausted = new Set(
    lines.filter((l) => l.sku === line.sku && l.shortQty > 0).map((l) => l.locationCode),
  );
  const bin = (await mockPickableBinCodes(task.warehouseId)).find((code) => !exhausted.has(code));
  if (!bin) return null;
  line.status = "CANCELLED";
  const added: MockPickLine = {
    lineId: uuidOf(`pick-line:${task.taskId}:${line.lineId}:reallocated`),
    taskId: task.taskId,
    sequenceNo: Math.max(...lines.map((l) => l.sequenceNo)) + 1,
    orderLineId: line.orderLineId,
    sku: line.sku,
    barcode: line.barcode,
    locationCode: bin,
    allocatedQty: line.allocatedQty,
    pickedQty: 0,
    status: "OPEN",
    putBackQty: 0,
    shortQty: 0,
    lpn: lpnOf(task.taskId, line.orderLineId, 0, `:${line.lineId}`),
    wholeCarton: true,
  };
  lines.push(added);
  return [added];
}

/** `PickLineResponse` — field chưa có giá trị bị bỏ (Jackson non_null). */
export function toPickLineResponse(line: MockPickLine) {
  return { ...line };
}

/**
 * BE `IdempotencyFilter`: cùng key + cùng body → trả lại response đã lưu; cùng key, body khác →
 * 422 IDEMPOTENCY_KEY_REUSED. Chỉ lưu response < 500, trừ 408/409/423/425/429.
 */
export async function withIdempotency(
  config: AxiosRequestConfig,
  run: () => Promise<MockResponse>,
): Promise<MockResponse> {
  const headers: unknown = config.headers;
  const raw =
    headers && typeof headers === "object" && "Idempotency-Key" in headers
      ? headers["Idempotency-Key"]
      : undefined;
  const key = typeof raw === "string" ? raw : undefined;
  if (!key) return run();
  const scoped = `${config.method ?? ""} ${config.url ?? ""} ${key}`;
  const body = typeof config.data === "string" ? config.data : JSON.stringify(config.data ?? null);
  const seen = idempotent.get(scoped);
  if (seen) {
    if (seen.body !== body) {
      return beError(422, "IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used");
    }
    return seen.response;
  }
  const response = await run();
  if (response.status < 500 && ![408, 409, 423, 425, 429].includes(response.status)) {
    idempotent.set(scoped, { body, response });
  }
  return response;
}

/**
 * BE `OrderCancellationListener` + `PickJpaEntity#cancel`: đơn bị huỷ → pick + pack huỷ; đã bắt đầu lấy thì đánh
 * dấu trả về kệ; chỉ dòng OPEN huỷ theo (`PickList.cancelOpenLines`) — dòng SHORT giữ nguyên, dòng PICKED / STAGED
 * giữ nguyên chờ cất lại (docs 07 §4.5 bước 13). Đơn đã đóng gói không huỷ được (mock đơn hàng chặn từ trước).
 */
export async function syncCancelledOrders(tasks: readonly MockTask[]): Promise<void> {
  for (const task of tasks) {
    if (task.pickStatus === "CANCELLED") continue;
    if ((await backendOrderStatusOf(task.orderId)) !== "CANCELLED") continue;
    const lines = await getMockPickLines(task);
    task.needsPutBack = task.pickStatus !== "PENDING";
    task.pickStatus = "CANCELLED";
    task.packStatus = "CANCELLED";
    for (const line of lines) {
      if (line.status === "OPEN") line.status = "CANCELLED";
    }
  }
}
