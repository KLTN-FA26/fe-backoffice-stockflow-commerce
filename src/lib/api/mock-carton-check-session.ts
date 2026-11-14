/**
 * Mock trạm kiểm thùng — luật của một phiên kiểm thùng, chép từ BE `CartonCheck` (4C-6, docs 08). Thuần: không đọc
 * order / store / auth; lỗi ném `PackError` (route đổi thành `errorCode` BE).
 */

import { PackError } from "./mock-pack-error";

export type MockCartonStatus = "TO_CHECK" | "CHECKED" | "LABELED" | "REMOVED";

export interface MockCarton {
  packageId: string;
  packageNo: number;
  labelCode: string;
  lpn: string;
  pickLineId: string;
  orderLineId: string;
  sku: string;
  lotNumber?: string;
  quantity: number;
  status: MockCartonStatus;
  checkedAt?: string;
  labeledAt?: string;
  labelVersion: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
  dimWeightKg?: number;
  rotatable: boolean;
  shipmentId?: string;
  removalReason?: "DAMAGED" | "ORDER_CANCELLED";
  removalNote?: string;
}

export interface MockShipment {
  shipmentId: string;
  code: string;
  status: string;
  packageCount: number;
  partial: boolean;
  partialNote?: string;
  readyAt: string;
  requestId?: string;
}

export interface MockCheckSession {
  taskId: string;
  orderNumber: string;
  startedBy?: string;
  startedByName?: string;
  startedAt?: string;
  completedAt?: string;
  cartons: MockCarton[];
  shipments: MockShipment[];
}

/** Quy cách thùng của SKU (docs 01): kích thước D × R × C (cm), khối lượng thùng đầy (kg), cờ cho phép xoay. */
export interface MockCartonSpec {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  rotatable: boolean;
}

/** BE `stockflow.fulfillment.packing.dim-divisor` (mặc định 6000): quy đổi cm³ → kg (docs 08 BR-09). */
export const DIM_DIVISOR = 6000;

const notInTask = (lpn: string, orderNumber: string) =>
  new PackError(
    409,
    "CARTON_NOT_IN_TASK",
    `Carton ${lpn.trim()} was not picked for order ${orderNumber}: ask the warehouse manager to check the picking and the stock`,
  );

const sameLpn = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

export function findMockCarton(session: MockCheckSession, lpn: string): MockCarton {
  const carton = session.cartons.find((candidate) => sameLpn(candidate.lpn, lpn));
  if (!carton) throw notInTask(lpn, session.orderNumber);
  return carton;
}

const removed = (carton: MockCarton) =>
  new PackError(
    409,
    "PACK_STATE_CONFLICT",
    `Carton ${carton.lpn} was removed from the order (${carton.removalReason}); it waits in the put-back queue`,
  );

/** BE `CartonCheck.check`: To Check → Checked; đã Checked / Labeled thì giữ nguyên (BR-05); Removed → 409. */
export function checkMockCarton(session: MockCheckSession, lpn: string, at: string): MockCarton {
  const carton = findMockCarton(session, lpn);
  if (carton.status === "CHECKED" || carton.status === "LABELED") return carton;
  if (carton.status === "REMOVED") throw removed(carton);
  carton.status = "CHECKED";
  carton.checkedAt = at;
  return carton;
}

function measure(carton: MockCarton, spec: MockCartonSpec): void {
  carton.lengthCm = spec.lengthCm;
  carton.widthCm = spec.widthCm;
  carton.heightCm = spec.heightCm;
  carton.weightKg = spec.weightKg;
  carton.rotatable = spec.rotatable;
  carton.dimWeightKg =
    Math.round(((spec.lengthCm * spec.widthCm * spec.heightCm) / DIM_DIVISOR) * 1000) / 1000;
}

/**
 * BE `CartonCheck.label`: dán nhãn các thùng được chọn, hoặc mọi thùng Checked. Thùng To Check → 409
 * `CARTON_NOT_CHECKED`; thùng Removed → 409 `PACK_STATE_CONFLICT`; SKU thiếu quy cách → 422 `CARTON_SPEC_UNMEASURED`
 * (cả loạt không dán — tất cả hoặc không gì). Gửi lại → không đổi gì.
 */
export function labelMockCartons(
  session: MockCheckSession,
  lpns: readonly string[] | undefined,
  specs: ReadonlyMap<string, MockCartonSpec>,
  at: string,
): MockCarton[] {
  let chosen: MockCarton[];
  if (!lpns || lpns.length === 0) {
    chosen = session.cartons.filter((c) => c.status === "CHECKED");
    if (chosen.length === 0 && session.cartons.some((c) => c.status === "LABELED")) return [];
    if (chosen.length === 0) {
      throw new PackError(
        409,
        "CARTON_NOT_CHECKED",
        `No checked carton of order ${session.orderNumber} is waiting for a label`,
      );
    }
  } else {
    const named = new Map<string, MockCarton>();
    for (const lpn of lpns) {
      const carton = findMockCarton(session, lpn);
      if (carton.status === "TO_CHECK") {
        throw new PackError(
          409,
          "CARTON_NOT_CHECKED",
          `Scan carton ${carton.lpn} first: only a checked carton is labelled`,
        );
      }
      if (carton.status === "REMOVED") throw removed(carton);
      named.set(carton.packageId, carton);
    }
    chosen = [...named.values()].filter((c) => c.status === "CHECKED");
  }
  const unmeasured = [...new Set(chosen.filter((c) => !specs.has(c.sku)).map((c) => c.sku))].sort();
  if (unmeasured.length > 0) {
    throw new PackError(
      422,
      "CARTON_SPEC_UNMEASURED",
      `The carton spec of ${unmeasured.join(", ")} declares no size or full weight`,
      unmeasured.map((sku) => ({ field: "sku", message: sku, code: "CartonSpecUnmeasured" })),
    );
  }
  for (const carton of chosen) {
    const spec = specs.get(carton.sku);
    if (spec) measure(carton, spec);
    carton.status = "LABELED";
    carton.labelVersion = 1;
    carton.labeledAt = at;
  }
  return chosen;
}

/** BE `CartonCheck.reprint`: chỉ thùng Labeled; `fromVersion` đã qua → không đổi gì (gửi lại); mỗi lần +1 phiên bản. */
export function reprintMockCarton(
  session: MockCheckSession,
  lpn: string,
  fromVersion: number | undefined,
  spec: MockCartonSpec | undefined,
): MockCarton {
  const carton = findMockCarton(session, lpn);
  if (carton.status !== "LABELED") {
    throw new PackError(
      409,
      "CARTON_NOT_CHECKED",
      `Carton ${carton.lpn} is ${carton.status}: only a labelled carton's label is printed again`,
    );
  }
  if (fromVersion !== undefined && carton.labelVersion > fromVersion) return carton;
  if (spec) measure(carton, spec);
  carton.labelVersion += 1;
  return carton;
}

/** BE `CartonCheck.remove`: Removed (hư hỏng); đã Removed → giữ nguyên; đã vào shipment → 409 `PACKAGE_SHIPPED`. */
export function removeMockCarton(
  session: MockCheckSession,
  lpn: string,
  note: string | undefined,
): MockCarton {
  const carton = findMockCarton(session, lpn);
  if (carton.status === "REMOVED") return carton;
  if (carton.shipmentId) {
    throw new PackError(
      409,
      "PACKAGE_SHIPPED",
      `Carton ${carton.lpn} is in a shipment already; it leaves the order only through the shipment`,
    );
  }
  carton.status = "REMOVED";
  carton.removalReason = "DAMAGED";
  carton.removalNote = note?.trim() || undefined;
  return carton;
}

/** Số cái trong các thùng đã dán nhãn của một dòng (đã vào shipment hay chưa). */
export const labeledUnitsOf = (session: MockCheckSession, orderLineId: string): number =>
  session.cartons
    .filter((c) => c.orderLineId === orderLineId && c.status === "LABELED")
    .reduce((sum, c) => sum + c.quantity, 0);

export interface CompletionPlan {
  cartons: MockCarton[];
  partial: boolean;
}

/**
 * BE `CartonCheck.complete`, theo thứ tự docs 08 §4.4 bước 8: (1) còn thùng To Check / Checked → `PACKING_INCOMPLETE`;
 * (2) không có thùng Labeled chưa vào shipment → `PACK_NOTHING_TO_SHIP`; (3) thiếu so với dòng đơn: không xin giao một
 * phần → `PACKING_INCOMPLETE`; đơn không cho phép → `PACK_PARTIAL_NOT_ALLOWED`; thiếu ghi chú → 400.
 */
export function planMockCompletion(
  session: MockCheckSession,
  wanted: ReadonlyMap<string, number>,
  partialRequested: boolean,
  partialAllowed: boolean,
  note: string | undefined,
): CompletionPlan {
  const open = session.cartons.filter((c) => c.status === "TO_CHECK" || c.status === "CHECKED");
  if (open.length > 0) {
    throw new PackError(
      409,
      "PACKING_INCOMPLETE",
      `${open.length} carton(s) still to check or label, or to remove: ${open.map((c) => c.lpn).join(", ")}`,
      open.map((c) => ({ field: `cartons[${c.lpn}]`, message: c.status, code: "NotLabeled" })),
    );
  }
  const toShip = session.cartons.filter((c) => c.status === "LABELED" && !c.shipmentId);
  if (toShip.length === 0) {
    throw new PackError(
      409,
      "PACK_NOTHING_TO_SHIP",
      `No labelled carton of order ${session.orderNumber} waits to ship`,
    );
  }
  const missing = [...wanted].filter(([line, units]) => labeledUnitsOf(session, line) < units);
  if (missing.length > 0) {
    if (!partialRequested) {
      throw new PackError(
        409,
        "PACKING_INCOMPLETE",
        "Cartons are missing; complete in part if the order allows it",
      );
    }
    if (!partialAllowed) {
      throw new PackError(
        409,
        "PACK_PARTIAL_NOT_ALLOWED",
        `Order ${session.orderNumber} does not allow partial delivery: label every carton, or ask Sales to allow partial delivery on the order`,
      );
    }
    if (!note?.trim()) {
      throw new PackError(400, "VALIDATION_FAILED", "A partial completion says why", [
        { field: "note", message: "required for a partial completion" },
      ]);
    }
  }
  return { cartons: toShip, partial: missing.length > 0 };
}
