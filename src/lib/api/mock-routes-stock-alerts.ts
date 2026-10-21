/** Shared alert summary; the paginated list is registered once by inventory-stock routes. */
import { DASHBOARD_API } from "@/constants/dashboard";
import { STOCK_ALERT_KINDS } from "@/constants/inventory";

import { registerMockRoute } from "./mock-adapter";
import { MOCK_STOCK_ALERTS } from "./mock-routes-inventory-stock-data";
import { beOk } from "./mock-routes-purchase-orders-store";

export function registerStockAlertMockRoutes(): void {
  registerMockRoute("GET", DASHBOARD_API.alertSummary, () =>
    beOk({
      openByKind: Object.fromEntries(
        STOCK_ALERT_KINDS.map((kind) => [
          kind,
          MOCK_STOCK_ALERTS.filter((alert) => alert.kind === kind && alert.status === "OPEN")
            .length,
        ]),
      ),
    }),
  );
}
