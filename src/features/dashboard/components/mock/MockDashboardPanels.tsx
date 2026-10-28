/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true. The widgets below (cross-module warning
 * list, shipment activity feed, warehouse utilisation, replenishment proposals) have no backend
 * endpoint, so in real mode the dashboard shows only what the real APIs provide.
 */
import { MockActivity } from "./MockActivity";
import { MockReplenishment } from "./MockReplenishment";
import { MockWarehousePanel } from "./MockWarehousePanel";
import { MockWarningTable } from "./MockWarningTable";

export function MockDashboardPanels() {
  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MockWarningTable />
        <MockActivity />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MockWarehousePanel />
        <MockReplenishment />
      </div>
    </>
  );
}
