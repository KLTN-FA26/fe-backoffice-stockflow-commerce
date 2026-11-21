/**
 * Sổ thùng cho mock kiểm kê / điều chỉnh / cách ly (docs 20), chỉ dùng khi USE_MOCK=true.
 *
 * Mock không có sổ thùng riêng: thùng sống trên dòng phiếu nhận (`MockReceiptLine.packages`, xem
 * `mock-receipt-cartons.ts`), nên điều chỉnh, kiểm kê và cách ly đọc / đổi đúng thùng đó — không bịa thùng. Một
 * thùng chỉ vào "tồn" khi phiếu nhận ghi nhận nó (RECEIVING → IN_STOCK). Cờ cách ly là trạng thái tồn của hàng
 * trong thùng (docs 20 §5.1), mock giữ ở đây vì phiếu nhận không có chỗ cho nó.
 */

import { getReceiptStore } from "./mock-routes-goods-receipts-store";

import type { MockReceiptPackage, MockStockPackageStatus } from "./mock-receipt-cartons";

export interface MockCarton {
  pkg: MockReceiptPackage;
  sku: string;
  lotNumber: string | null;
}

/**
 * Thùng tồn đầu kỳ của seed BE (`V20261111000110` → `inventory.stock_package`): 75 thùng IN_STOCK, mỗi thùng 1 đơn
 * vị, nằm đúng 4 vị trí có tồn của bản đồ (`stockedLocations` của mock bản đồ). Không đến từ phiếu nhận nên mock giữ
 * riêng ở đây. Lô theo `inventory.stock_item` của seed (SOFA không theo lô → `null`); thùng ở HCM-QC01 mang tồn
 * QUARANTINE.
 */
const OPENING_CARTONS = [
  { sku: "SOFA-3S-GREY", lot: null, location: "HCM-A01-2-B", first: 1, count: 25 },
  { sku: "SOFA-3S-GREY", lot: null, location: "HCM-A02-1-A", first: 26, count: 8 },
  { sku: "TABLE-OAK-160", lot: "LOT-2026-03", location: "HCM-B01-1-A", first: 34, count: 12 },
  {
    sku: "TABLE-OAK-160",
    lot: "LOT-2026-04",
    location: "HCM-QC01",
    first: 46,
    count: 30,
    quarantined: true,
  },
] as const;

const openingLpn = (n: number) => `LPN-20261111-${String(n).padStart(6, "0")}`;

function seedOpeningCartons(): MockCarton[] {
  return OPENING_CARTONS.flatMap(({ sku, lot, location, first, count }) =>
    Array.from({ length: count }, (_, i) => {
      const lpn = openingLpn(first + i);
      return {
        sku,
        lotNumber: lot,
        pkg: {
          id: `mock-opening-${lpn}`,
          lpn,
          quantity: 1,
          receivedQty: 1,
          nominalQty: 1,
          status: "IN_STOCK" as const,
          locationCode: location,
        },
      };
    }),
  );
}

const seedQuarantined = () =>
  OPENING_CARTONS.flatMap((group) =>
    "quarantined" in group
      ? Array.from({ length: group.count }, (_, i) => openingLpn(group.first + i))
      : [],
  );

let opening = seedOpeningCartons();
const quarantined = new Set<string>(seedQuarantined());

/** Nhiệm vụ cất hàng nguồn QUARANTINE_RELEASE đã mở cho một thùng (docs 20 §4.8 bước 3). */
export interface MockReleaseTask {
  id: string;
  lpn: string;
  status: string;
  sourceLocationCode: string;
}
const releases = new Map<string, MockReleaseTask>();

export function resetMockCartonLedger(): void {
  opening = seedOpeningCartons();
  quarantined.clear();
  for (const lpn of seedQuarantined()) quarantined.add(lpn);
  releases.clear();
}

/** Gọi lại trả đúng nhiệm vụ đã mở (BE idempotent). */
export function openMockReleaseTask(carton: MockCarton): MockReleaseTask {
  const lpn = carton.pkg.lpn.toUpperCase();
  const task = releases.get(lpn) ?? {
    id: crypto.randomUUID(),
    lpn: carton.pkg.lpn,
    status: "OPEN",
    sourceLocationCode: carton.pkg.locationCode ?? "",
  };
  releases.set(lpn, task);
  return task;
}

/** Nhiệm vụ cất hàng đã mở do giải phóng cách ly — store cất hàng mock đọc để hiện trên màn Cất hàng. */
export function listMockReleaseTasks(): MockReleaseTask[] {
  return [...releases.values()];
}

export async function listMockCartons(): Promise<MockCarton[]> {
  const cartons: MockCarton[] = [];
  for (const receipt of (await getReceiptStore()).values()) {
    for (const line of receipt.lines) {
      for (const pkg of line.packages ?? []) {
        if (pkg.status !== "VOID") {
          cartons.push({ pkg, sku: line.sku ?? "", lotNumber: line.lotNumber });
        }
      }
    }
  }
  return [...cartons, ...opening.filter((carton) => carton.pkg.status !== "VOID")];
}

/** BE `StockPackageRepository.findByLpn`: LPN không phân biệt hoa thường. */
export async function findMockCarton(lpn: string): Promise<MockCarton | null> {
  const wanted = lpn.trim().toUpperCase();
  return (
    (await listMockCartons()).find((carton) => carton.pkg.lpn.toUpperCase() === wanted) ?? null
  );
}

export function setMockCartonStatus(carton: MockCarton, status: MockStockPackageStatus): void {
  carton.pkg.status = status;
}

export function isMockQuarantined(lpn: string): boolean {
  return quarantined.has(lpn.toUpperCase());
}

export function setMockQuarantined(lpn: string, value: boolean): void {
  if (value) quarantined.add(lpn.toUpperCase());
  else quarantined.delete(lpn.toUpperCase());
}

/** Mã kho của một vị trí: đoạn trước dấu gạch đầu tiên (BE `LocationId.warehouseCode()`). */
export function mockWarehouseCodeOf(location: string | null): string {
  const value = (location ?? "").toUpperCase();
  const dash = value.indexOf("-");
  return dash > 0 ? value.slice(0, dash) : value;
}
