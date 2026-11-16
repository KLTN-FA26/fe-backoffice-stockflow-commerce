/**
 * Mock tra cứu thùng + cách ly / gỡ cách ly (BE StockPackageController, docs 20 §4.8, BR-21), chỉ dùng khi
 * USE_MOCK=true.
 *
 * Hợp đồng chép từ BE develop df34c338: `GET /inventory/stock-packages/{lpn}`, `POST …/quarantine`
 * (thùng tự do, nguyên thùng, vào khu QUARANTINE cùng kho; không qua duyệt), `POST …/quarantine-release`
 * (mở nhiệm vụ cất hàng QUARANTINE_RELEASE, thùng vẫn cách ly tới khi cất xong). Thùng lấy từ sổ thùng mock.
 * Không mô phỏng giữ hàng cho đơn (STOCK_PACKAGE_HELD) vì mock thùng không có khoản giữ.
 */

import { QUARANTINE_API } from "@/constants/quarantine";

import { registerMockRoute } from "./mock-adapter";
import {
  findMockCarton,
  isMockQuarantined,
  mockWarehouseCodeOf,
  openMockReleaseTask,
  setMockQuarantined,
} from "./mock-inventory-cartons";
import { hasPendingMockAdjustment } from "./mock-routes-inventory";
import { MOCK_AREAS } from "./mock-routes-goods-receipts-store";
import { beError, parseJsonBody, readString } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { MockCarton } from "./mock-inventory-cartons";

const ok = (data: unknown, status = 200) => ({
  status,
  data: { success: true, data },
  headers: {},
});
// Cùng đường dẫn với `QUARANTINE_API` (`:lpn` thay cho LPN đã mã hoá).
const STOCK_PACKAGES = QUARANTINE_API.carton("").replace(/\/$/, "");

function lpnOf(config: AxiosRequestConfig): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return typeof params === "object" && params !== null && "lpn" in params
    ? readString(params.lpn)
    : "";
}

/** `StockPackageDetailResponse`: hàng trong thùng mang trạng thái tồn (docs 20 §5.1). */
function detail(carton: MockCarton) {
  const { pkg } = carton;
  const holding = pkg.status === "IN_STOCK" || pkg.status === "RECEIVING";
  const stockStatus = isMockQuarantined(pkg.lpn)
    ? "QUARANTINE"
    : pkg.status === "RECEIVING"
      ? "INBOUND"
      : "AVAILABLE";
  return {
    lpn: pkg.lpn,
    sku: carton.sku,
    unitOfMeasure: "CARTON",
    nominalQty: pkg.nominalQty,
    receivedQty: pkg.receivedQty,
    ...(carton.lotNumber ? { lotNumber: carton.lotNumber } : {}),
    onHand: holding ? pkg.receivedQty : 0,
    reserved: 0,
    status: pkg.status,
    ...(pkg.locationCode ? { locationCode: pkg.locationCode } : {}),
    contents: holding
      ? [
          {
            ...(carton.lotNumber ? { lotNumber: carton.lotNumber } : {}),
            status: stockStatus,
            onHand: pkg.receivedQty,
            reserved: 0,
          },
        ]
      : [],
  };
}

async function load(config: AxiosRequestConfig) {
  const lpn = lpnOf(config);
  const carton = await findMockCarton(lpn);
  return carton
    ? { carton }
    : { error: beError(404, "STOCK_PACKAGE_NOT_FOUND", `No carton with LPN ${lpn}`) };
}

async function quarantine(config: AxiosRequestConfig) {
  const body = parseJsonBody(config.data);
  const location = readString(body.locationCode).toUpperCase();
  const reason = readString(body.reason);
  const fieldErrors = [
    ...(location
      ? []
      : [{ field: "locationCode", message: "locationCode is required", code: "NotBlank" }]),
    ...(reason ? [] : [{ field: "reason", message: "reason is required", code: "NotBlank" }]),
  ];
  if (fieldErrors.length)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", fieldErrors);
  const loaded = await load(config);
  if (loaded.error) return loaded.error;
  const { carton } = loaded;
  if (isMockQuarantined(carton.pkg.lpn))
    return beError(409, "STOCK_PACKAGE_QUARANTINED", "The carton is already in quarantine");
  if (carton.pkg.status !== "IN_STOCK")
    return beError(409, "INVALID_STOCK_PACKAGE_TRANSITION", "This stock package cannot do that");
  if (MOCK_AREAS[location] !== "QUARANTINE")
    return beError(409, "LOCATION_AREA_MISMATCH", "The location is not a QUARANTINE area");
  if (mockWarehouseCodeOf(location) !== mockWarehouseCodeOf(carton.pkg.locationCode))
    return beError(
      409,
      "MOVE_ACROSS_WAREHOUSES",
      "Stock moves only between locations of one warehouse",
    );
  if (hasPendingMockAdjustment(carton.pkg.id))
    return beError(
      409,
      "STOCK_PACKAGE_DECISION_PENDING",
      "A decision about this carton is already under way",
    );
  // Cách ly là đổi chỗ + trạng thái tồn, không đổi số lượng: không qua duyệt (docs 20 §4.8).
  carton.pkg.locationCode = location;
  setMockQuarantined(carton.pkg.lpn, true);
  return ok(detail(carton));
}

async function release(config: AxiosRequestConfig) {
  const loaded = await load(config);
  if (loaded.error) return loaded.error;
  const { carton } = loaded;
  if (!isMockQuarantined(carton.pkg.lpn))
    return beError(409, "STOCK_PACKAGE_NOT_QUARANTINED", "The carton is not in quarantine");
  if (hasPendingMockAdjustment(carton.pkg.id))
    return beError(
      409,
      "STOCK_PACKAGE_DECISION_PENDING",
      "A decision about this carton is already under way",
    );
  // Gọi lại trả đúng nhiệm vụ đã mở; thùng vẫn cách ly tới khi cất xong (docs 20 §4.8 bước 3).
  return ok(openMockReleaseTask(carton));
}

export function registerQuarantineMockRoutes(): void {
  registerMockRoute("GET", `${STOCK_PACKAGES}/:lpn`, async (config) => {
    const loaded = await load(config);
    return loaded.error ?? ok(detail(loaded.carton));
  });
  registerMockRoute("POST", `${STOCK_PACKAGES}/:lpn/quarantine`, quarantine);
  registerMockRoute("POST", `${STOCK_PACKAGES}/:lpn/quarantine-release`, release);
}
