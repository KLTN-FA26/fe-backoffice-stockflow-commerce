/**
 * Chính sách tồn của hồ sơ hàng tồn trong mock (BE PR #119 `StockPolicy`): kho `policies` theo id
 * item, luật `validate` và `evaluation`. Version dùng chung với logistics (kho `logistics` của
 * mock biến thể).
 */
import { fail } from "./mock-route-utils";

export interface MockPolicy {
  reorderPoint: number | null;
  safetyStock: number | null;
  maxQty: number | null;
  removalStrategy: "FIFO" | "FEFO";
  trackingMode: "NONE" | "LOT" | "SERIAL" | "LOT_SERIAL";
  expiryTracked: boolean;
  maxShelfLifeDays: number | null;
}

export const DEFAULT_POLICY: MockPolicy = {
  reorderPoint: null,
  safetyStock: null,
  maxQty: null,
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  maxShelfLifeDays: null,
};

export const policies = new Map<string, MockPolicy>();

export function resetInventoryPolicyStore(): void {
  policies.clear();
}

export const policyOf = (itemId: string): MockPolicy => policies.get(itemId) ?? DEFAULT_POLICY;

/** `policyConfigured` = có ít nhất một ngưỡng khác null. */
export const isConfigured = (p: MockPolicy) =>
  p.reorderPoint !== null || p.safetyStock !== null || p.maxQty !== null;

/** ASSUMPTION: mock không có tồn thật — tồn khả dụng cố định theo item (0–99). */
export function usableOnHandOf(itemId: string): number {
  let h = 0;
  for (const c of itemId) h = (h * 31 + c.charCodeAt(0)) % 100;
  return h;
}

export function evaluationOf(itemId: string, p: MockPolicy) {
  const usableOnHand = usableOnHandOf(itemId);
  return {
    usableOnHand,
    reorderPoint: p.reorderPoint,
    safetyStock: p.safetyStock,
    reorderRequired: p.reorderPoint === null ? null : usableOnHand <= p.reorderPoint,
    belowSafetyStock: p.safetyStock === null ? null : usableOnHand < p.safetyStock,
  };
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** Body PUT → policy (enum lạ rơi về mặc định; BE thật trả 400 từ bean validation). */
export function readPolicy(b: Record<string, unknown>): MockPolicy {
  return {
    reorderPoint: num(b.reorderPoint),
    safetyStock: num(b.safetyStock),
    maxQty: num(b.maxQty),
    removalStrategy: b.removalStrategy === "FEFO" ? "FEFO" : "FIFO",
    trackingMode:
      b.trackingMode === "LOT" || b.trackingMode === "SERIAL" || b.trackingMode === "LOT_SERIAL"
        ? b.trackingMode
        : "NONE",
    expiryTracked: b.expiryTracked === true,
    maxShelfLifeDays: num(b.maxShelfLifeDays),
  };
}

const invalid = (message: string, fieldErrors: Parameters<typeof fail>[3] = []) =>
  fail(400, "INVENTORY_POLICY_INVALID", message, fieldErrors);

/** BE PR #119 `StockPolicy.validate` (docs 02 §4) — trả response lỗi hoặc `null` khi hợp lệ. */
export function validatePolicy(p: MockPolicy) {
  const { reorderPoint: reorder, safetyStock: safety, maxQty: max } = p;
  // Luật 1: ngưỡng không âm
  if ([reorder, safety, max].some((v) => v !== null && v < 0))
    return invalid("Thresholds must not be negative");
  // Luật 2: tồn an toàn không vượt điểm đặt lại
  if (reorder !== null && safety !== null && safety > reorder)
    return invalid("safetyStock must not exceed reorderPoint");
  // Luật 3: tồn tối đa ≥ điểm đặt lại và ≥ tồn an toàn
  if (max !== null && ((reorder !== null && max < reorder) || (safety !== null && max < safety)))
    return invalid("maxQty must be at least the reorder point and safety stock", [
      {
        field: "maxQty",
        message: "maxQty must be at least the thresholds",
        code: "INVENTORY_MAX_QTY_BELOW_THRESHOLD",
      },
    ]);
  const lot = p.trackingMode === "LOT" || p.trackingMode === "LOT_SERIAL";
  // Luật 4: theo dõi hạn dùng cần theo dõi lô và FEFO
  if (p.expiryTracked && !(lot && p.removalStrategy === "FEFO"))
    return invalid("Expiry tracking needs lot tracking and FEFO");
  // Luật 5: hạn dùng tối đa 1–36500 ngày và chỉ khi theo dõi hạn dùng
  if (p.maxShelfLifeDays !== null) {
    if (!p.expiryTracked) return invalid("maxShelfLifeDays needs expiry tracking");
    if (p.maxShelfLifeDays < 1 || p.maxShelfLifeDays > 36500)
      return invalid("maxShelfLifeDays must be 1-36500");
  }
  return null;
}
