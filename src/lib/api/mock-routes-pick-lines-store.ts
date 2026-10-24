/**
 * Mock dòng lấy hàng — store in-memory + helper cho `mock-routes-pick-lines.ts`.
 * Wire shape = BE `PickLineResponse` (SCRUM-267, `shortQty` BE PR #147). Dòng dựng từ dòng hàng thường của
 * đơn mock (dòng in không lấy từ kệ — BR-06), vị trí từ bin mock của kho task. Chỉ dùng khi USE_MOCK=true.
 */

import { fakeSha256 } from "./mock-routes-orders";
import { beError } from "./mock-routes-purchase-orders-store";
import { mockPickableBinCodes } from "./mock-routes-warehouse-layout";

import type { AxiosRequestConfig } from "axios";
import type { MockResponse } from "./mock-adapter";
import type { MockTask } from "./mock-routes-fulfillment-store";

export type MockPickLineStatus = "OPEN" | "PICKED" | "SHORT" | "CANCELLED" | "PUT_BACK";

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

/**
 * BE `planLines`: một dòng mỗi dòng hàng thường của đơn, ở bin của kho task, xếp theo lộ trình (mã
 * vị trí). ASSUMPTION (mock-only): mỗi dòng giữ hàng ở một bin lấy được, lần lượt theo chỉ số.
 */
async function plan(task: MockTask): Promise<MockPickLine[]> {
  const { orders, skus } = await import("@/lib/mock-data");
  const order = orders.find((candidate) => candidate.orderId === task.orderId);
  if (!order) return [];
  const bins = await mockPickableBinCodes(task.warehouseId);
  return order.lines
    .filter((line) => !line.designId)
    .map((line, index) => ({
      lineId: uuidOf(`pick-line:${task.taskId}:${line.lineId}`),
      taskId: task.taskId,
      sequenceNo: 0,
      orderLineId: line.lineId,
      sku: line.skuId,
      barcode: skus.find((sku) => sku.skuId === line.skuId)?.barcode,
      locationCode: bins[index % Math.max(bins.length, 1)] ?? "UNKNOWN",
      allocatedQty: line.quantity,
      pickedQty: 0,
      status: "OPEN" as const,
      putBackQty: 0,
      shortQty: 0,
    }))
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode))
    .map((line, index) => ({ ...line, sequenceNo: index + 1 }));
}

export function markPicked(line: MockPickLine, at: string): void {
  line.status = "PICKED";
  line.pickedQty = line.allocatedQty;
  line.pickedAt = at;
}

/**
 * Dòng của task; lần đầu thì lập kế hoạch. Task seed ở trạng thái giữa chừng có dòng tương ứng:
 * PICKING → dòng đầu đã lấy; PICKED → mọi dòng; CANCELLED (huỷ sau khi lấy) → dòng đầu đã lấy, còn
 * lại huỷ. Task mới (PENDING) → mọi dòng OPEN.
 */
export async function getMockPickLines(task: MockTask): Promise<MockPickLine[]> {
  const stored = linesByTask.get(task.taskId);
  if (stored) return stored;
  const lines = await plan(task);
  const at = task.startedAt ?? task.assignedAt;
  lines.forEach((line, index) => {
    if (task.pickStatus === "PICKED" || (index === 0 && task.pickStatus !== "PENDING")) {
      markPicked(line, at);
    } else if (task.pickStatus === "CANCELLED") {
      line.status = "CANCELLED";
    }
  });
  linesByTask.set(task.taskId, lines);
  return lines;
}

/** BE `PickLine.reportShort`: dòng → SHORT, ghi số thiếu; không trừ tồn, không ghi số đã lấy. */
export function reportMockShort(line: MockPickLine, found: number): void {
  line.status = "SHORT";
  line.shortQty = line.allocatedQty - found;
}

/**
 * BE `reallocateShort` (X-SHORT bước 04): cùng SL sang bin khác của kho, không dùng lại bin đã báo thiếu SKU
 * này trong task. Dòng thiếu → CANCELLED (giữ `shortQty`), thêm một dòng OPEN ở cuối lộ trình.
 * ASSUMPTION (mock-only): bin còn lại nào cũng đủ hàng; hết bin → `null` (route trả 409 INSUFFICIENT_STOCK).
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
