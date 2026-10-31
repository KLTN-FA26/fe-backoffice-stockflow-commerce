/**
 * Thùng có LPN trên phiếu nhận mock (BE SCRUM-473 #197), chỉ dùng khi USE_MOCK=true.
 *
 * Mock không có sổ thùng riêng: thùng sống trên dòng phiếu (`MockReceiptLine.packages`), kể cả thùng VOID — BE giữ
 * VOID trong `inventory.stock_package` nhưng không trả trong `GoodsReceiptResponse`, nên `cartonLineView` lọc bỏ.
 */

import { beError } from "./mock-routes-purchase-orders-store";

import type { MockReceiptLine } from "./mock-routes-goods-receipts-store";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

export type MockStockPackageStatus = "RECEIVING" | "IN_STOCK" | "CONSUMED" | "LOST" | "VOID";

/** BE `GoodsReceiptResponse.Package` + trạng thái VOID chỉ mock giữ lại. */
export interface MockReceiptPackage {
  id: string;
  lpn: string;
  quantity: number;
  receivedQty: number;
  nominalQty: number;
  status: MockStockPackageStatus;
  locationCode: string | null;
}

/** BE `GoodsReceiptResponse.Unit`. */
export interface MockReceiptUnit {
  unitOfMeasure: string;
  factor: number;
  base: boolean;
  active: boolean;
  defaultPurchase: boolean;
}

/**
 * ASSUMPTION (mock): mock-data không có bảng quy đổi đơn vị (`uom_conversions`). Mỗi SKU có đơn vị cơ sở `PCS` và
 * một đơn vị đóng gói `CARTON` = 10, là đơn vị mua mặc định — đủ để demo chia thùng với SL seed (6–10).
 */
export const MOCK_CARTON_FACTOR = 10;

export function mockUnitsOf(sku: string | null): MockReceiptUnit[] {
  if (!sku) return [];
  return [
    { unitOfMeasure: "PCS", factor: 1, base: true, active: true, defaultPurchase: false },
    {
      unitOfMeasure: "CARTON",
      factor: MOCK_CARTON_FACTOR,
      base: false,
      active: true,
      defaultPurchase: true,
    },
  ];
}

/** Thùng BE còn trả về (mọi trạng thái trừ VOID). */
export function shownPackages(line: Pick<MockReceiptLine, "packages">): MockReceiptPackage[] {
  return (line.packages ?? []).filter((p) => p.status !== "VOID");
}

/** Các field thùng của `GoodsReceiptResponse.Line`, như BE `view()`: phần lẻ = SL dòng − Σ `receivedQty`. */
export function cartonLineView(line: MockReceiptLine) {
  const packages = shownPackages(line);
  return {
    unitOfMeasure: line.unitOfMeasure ?? null,
    looseQuantity: line.quantity - packages.reduce((sum, p) => sum + p.receivedQty, 0),
    packages,
    units: mockUnitsOf(line.sku),
    orderedUnitOfMeasure: null,
  };
}

/* ── Đếm thùng khi lưu kiểm đếm (BE `GoodsReceiptServiceImpl#cartonUnit` + `countReceivingPackages`) ── */

let lpnSequence = 0;

export function resetMockCartons(): void {
  lpnSequence = 0;
}

/** BE `LpnSequence`: `LPN-yyyyMMdd-nnnnnn`, ngày theo giờ VN. */
function nextLpn(now: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    .format(now)
    .replaceAll("-", "");
  lpnSequence += 1;
  return `LPN-${day}-${String(lpnSequence).padStart(6, "0")}`;
}

const STATUS_OF: Record<string, number> = {
  VALIDATION_FAILED: 400,
  RECEIPT_PACKAGES_EXCEED_LINE: 422,
  RECEIPT_LINE_UNIT_INVALID: 422,
  UOM_CONVERSION_NOT_FOUND: 404,
  RECEIPT_LINE_HAS_PACKAGES: 409,
  RECEIPT_PACKAGES_NOT_SUPPORTED: 409,
};

/** Dòng PO (phiếu không PO: SKU) + lô — khoá dòng của BE; đếm lại giữ id dòng và thùng của nó. */
const lineKey = (line: Pick<MockReceiptLine, "purchaseOrderLineId" | "sku" | "lotNumber">) =>
  `${line.purchaseOrderLineId ?? `sku:${line.sku ?? ""}`}|${line.lotNumber ?? ""}`;

interface RawCarton {
  lpn: string;
  quantity: number;
}

function readCartons(raw: unknown): RawCarton[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    const carton =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return {
      lpn: typeof carton.lpn === "string" ? carton.lpn.trim().toUpperCase() : "",
      quantity: typeof carton.quantity === "number" ? carton.quantity : 0,
    };
  });
}

/**
 * Áp thùng của request lên các dòng vừa đếm (`counted`, cùng thứ tự với `rawLines`). Lỗi từng ô như BE (`LineErrors`);
 * dòng từng có thùng bị bỏ khỏi phiếu → 409 `RECEIPT_LINE_HAS_PACKAGES`.
 */
export function applyCartonCounts(
  previous: readonly MockReceiptLine[],
  counted: readonly MockReceiptLine[],
  rawLines: readonly unknown[],
  now = new Date(),
): { lines: MockReceiptLine[] } | { error: ReturnType<typeof beError> } {
  const errors: (MockFieldError & { code: string })[] = [];
  const add = (i: number, field: string, code: string, message: string) =>
    errors.push({ field: `lines[${i}].${field}`, code, message });
  const lines = counted.map((line, i) => {
    const raw = rawLines[i];
    const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const was = previous.find((p) => lineKey(p) === lineKey(line));
    const before = was?.packages ?? [];
    const cartons = readCartons(input.packages);
    const units = mockUnitsOf(line.sku);
    const named =
      typeof input.unitOfMeasure === "string" ? input.unitOfMeasure.trim().toUpperCase() : "";
    const voidRest = (kept: Set<string>) =>
      before.map((p) =>
        p.status === "RECEIVING" && !kept.has(p.lpn) ? { ...p, status: "VOID" as const } : p,
      );
    if (cartons.length === 0) {
      const unit = units.find((u) => u.unitOfMeasure === named);
      if (named && !unit)
        add(i, "unitOfMeasure", "UOM_CONVERSION_NOT_FOUND", `${line.sku} has no unit ${named}`);
      else if (unit && !unit.base)
        add(
          i,
          "unitOfMeasure",
          "RECEIPT_LINE_UNIT_INVALID",
          `${named} is a packing unit: list the line's cartons in it`,
        );
      return {
        ...line,
        id: was?.id ?? line.id,
        unitOfMeasure: null,
        packages: voidRest(new Set()),
      };
    }
    const seen = new Set<string>();
    cartons.forEach((carton, j) => {
      if (carton.quantity < 1)
        add(i, `packages[${j}].quantity`, "VALIDATION_FAILED", "A carton holds at least 1 unit");
      if (carton.lpn && seen.has(carton.lpn))
        add(i, `packages[${j}].lpn`, "VALIDATION_FAILED", `${carton.lpn} is listed twice`);
      if (carton.lpn) seen.add(carton.lpn);
    });
    const total = cartons.reduce((sum, c) => sum + Math.max(c.quantity, 0), 0);
    if (total > line.quantity)
      add(
        i,
        "packages",
        "RECEIPT_PACKAGES_EXCEED_LINE",
        `The cartons hold ${total} units, more than the line's ${line.quantity}`,
      );
    const code = named || was?.unitOfMeasure || "";
    const unit = units.find((u) => u.unitOfMeasure === code);
    if (!code)
      add(i, "unitOfMeasure", "VALIDATION_FAILED", "Cartons need the packing unit they are in");
    else if (!unit)
      add(i, "unitOfMeasure", "UOM_CONVERSION_NOT_FOUND", `${line.sku} has no unit ${code}`);
    else if (unit.base)
      add(
        i,
        "unitOfMeasure",
        "RECEIPT_LINE_UNIT_INVALID",
        `Cartons are labelled in a packing unit, not in ${code}`,
      );
    else if (
      was?.unitOfMeasure &&
      was.unitOfMeasure !== code &&
      before.some((p) => seen.has(p.lpn))
    )
      add(
        i,
        "unitOfMeasure",
        "RECEIPT_LINE_HAS_PACKAGES",
        "Cartons in another unit are kept; leave them out to void them",
      );
    const packages = voidRest(seen);
    for (const carton of cartons) {
      const known = packages.findIndex((p) => p.lpn === carton.lpn && p.status === "RECEIVING");
      if (carton.lpn && known < 0)
        add(
          i,
          "packages",
          "STOCK_PACKAGE_NOT_FOUND",
          `${carton.lpn} is not a RECEIVING carton of this line`,
        );
      const measured = {
        quantity: carton.quantity,
        receivedQty: carton.quantity,
        nominalQty: unit?.factor ?? 1,
        locationCode: line.locationCode,
      };
      const existing = packages[known];
      if (existing) packages[known] = { ...existing, ...measured };
      else if (!carton.lpn)
        packages.push({
          id: crypto.randomUUID(),
          lpn: nextLpn(now),
          status: "RECEIVING",
          ...measured,
        });
    }
    return {
      ...line,
      id: was?.id ?? line.id,
      unitOfMeasure: unit?.unitOfMeasure ?? null,
      packages,
    };
  });
  const first = errors[0];
  if (first)
    return {
      error: beError(
        STATUS_OF[first.code] ?? 404,
        first.code,
        `Receipt line: ${first.message}`,
        errors,
      ),
    };
  const kept = new Set(lines.map((line) => line.id));
  const dropped = previous.filter((p) => !kept.has(p.id) && (p.packages?.length ?? 0) > 0);
  if (dropped.length > 0)
    return {
      error: beError(
        409,
        "RECEIPT_LINE_HAS_PACKAGES",
        `${dropped.length} line(s) left out of the count have had labelled cartons; cancel the receipt and count it again`,
      ),
    };
  return { lines };
}

/** Xác nhận ghi nhận phiếu: thùng RECEIVING vào kho — IN_STOCK, chưa mở. */
export function cartonsInStock(line: MockReceiptLine): MockReceiptLine {
  return {
    ...line,
    packages: line.packages?.map((p) =>
      p.status === "RECEIVING" ? { ...p, status: "IN_STOCK" } : p,
    ),
  };
}

/** Huỷ / từ chối phiếu: thùng RECEIVING bị VOID (BE `voidStockPackagesOfReceiptLines`). */
export function cartonsVoided(line: MockReceiptLine): MockReceiptLine {
  return {
    ...line,
    packages: line.packages?.map((p) => (p.status === "RECEIVING" ? { ...p, status: "VOID" } : p)),
  };
}
