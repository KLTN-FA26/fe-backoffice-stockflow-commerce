/**
 * Mock routes — cảnh báo tồn kho (BE `StockAlertController`, docs: inventory alerts), chỉ dùng khi
 * USE_MOCK=true.
 *
 * Cảnh báo sinh ra từ tồn thật (ngưỡng đặt hàng / tồn an toàn / hạn dùng) mà mock không có tồn, nên
 * danh sách luôn rỗng và `summary` trả đủ mọi loại với số 0 (BE: "Every kind is present, zero when
 * there is none"). Không bịa cảnh báo để dashboard có số.
 */

import { DASHBOARD_API } from "@/constants/dashboard";

import { registerMockRoute } from "./mock-adapter";
import { beError, beOk, bePage, readInt, readParams } from "./mock-routes-purchase-orders-store";

const BE_DEFAULT_PAGE_SIZE = 20; // Pages.DEFAULT_PAGE_SIZE
const BE_MAX_PAGE_SIZE = 200; // Pages.MAX_PAGE_SIZE
const ALERT_KINDS = ["REORDER", "SAFETY", "EXPIRING", "EXPIRED"] as const; // StockAlert.Kind

export function registerStockAlertMockRoutes(): void {
  registerMockRoute("GET", DASHBOARD_API.alerts, (config) => {
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported page parameters");
    }
    return beOk(bePage([], page, size));
  });
  registerMockRoute("GET", DASHBOARD_API.alertSummary, () =>
    beOk({ openByKind: Object.fromEntries(ALERT_KINDS.map((kind) => [kind, 0])) }),
  );
}
