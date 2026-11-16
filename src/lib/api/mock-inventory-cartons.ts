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

const quarantined = new Set<string>();

/** Nhiệm vụ cất hàng nguồn QUARANTINE_RELEASE đã mở cho một thùng (docs 20 §4.8 bước 3). */
export interface MockReleaseTask {
  id: string;
  lpn: string;
  status: string;
  sourceLocationCode: string;
}
const releases = new Map<string, MockReleaseTask>();

export function resetMockCartonLedger(): void {
  quarantined.clear();
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
  return cartons;
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
