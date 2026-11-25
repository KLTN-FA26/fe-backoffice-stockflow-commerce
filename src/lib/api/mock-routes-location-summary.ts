/**
 * Mock `GET /inventory/stock-packages/location-summary?location=` (BE `StockPackageLookup#atLocation`), chỉ dùng khi
 * USE_MOCK=true: một vị trí đang chứa gì, mỗi dòng một SKU + lô + trạng thái tồn. Đọc từ sổ thùng mock (thùng sống ở
 * vị trí) — mock không có hàng lẻ ngoài thùng nên `looseUnits` luôn 0. Thiếu `location` → 400 như BE.
 */

import { STOCK_PACKAGE_API } from "@/constants/quarantine";

import { registerMockRoute } from "./mock-adapter";
import { isMockQuarantined, listMockCartons } from "./mock-inventory-cartons";
import { beError, isRecord, readString } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";

const LIVE = new Set(["RECEIVING", "IN_STOCK"]);

interface SummaryLine {
  sku: string;
  lotNumber?: string;
  status: string;
  wholeCartons: number;
  wholeCartonUnits: number;
  looseUnits: number;
  totalUnits: number;
}

async function summary(config: AxiosRequestConfig) {
  const params = isRecord(config.params) ? config.params : {};
  const location = readString(params.location).trim().toUpperCase();
  if (!location) return beError(400, "VALIDATION_FAILED", "location is required");
  const lines = new Map<string, SummaryLine>();
  for (const carton of await listMockCartons()) {
    const { pkg } = carton;
    if (!LIVE.has(pkg.status) || (pkg.locationCode ?? "").toUpperCase() !== location) continue;
    const status = isMockQuarantined(pkg.lpn)
      ? "QUARANTINE"
      : pkg.status === "RECEIVING"
        ? "INBOUND"
        : "AVAILABLE";
    const key = `${carton.sku}|${carton.lotNumber ?? ""}|${status}`;
    const line = lines.get(key) ?? {
      sku: carton.sku,
      ...(carton.lotNumber ? { lotNumber: carton.lotNumber } : {}),
      status,
      wholeCartons: 0,
      wholeCartonUnits: 0,
      looseUnits: 0,
      totalUnits: 0,
    };
    line.wholeCartons += 1;
    line.wholeCartonUnits += pkg.receivedQty;
    line.totalUnits += pkg.receivedQty;
    lines.set(key, line);
  }
  return { status: 200, data: { success: true, data: [...lines.values()] }, headers: {} };
}

/** Đăng ký TRƯỚC `GET /inventory/stock-packages/:lpn` — adapter khớp route theo thứ tự đăng ký. */
export function registerLocationSummaryMockRoute(): void {
  registerMockRoute("GET", STOCK_PACKAGE_API.locationSummary, summary);
}
