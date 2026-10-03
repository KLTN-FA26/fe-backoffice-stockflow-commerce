"use client";

import { ADMIN_ROUTES, PO_PERMISSIONS } from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";
import { useCan } from "@/lib/auth";

import { PO_LIST_TABS, PoListHeader, PoListTabs } from "./list/PoListHeader";
import { PoOrdersTab } from "./list/PoOrdersTab";
import { SupplierSpendSection } from "./list/SupplierSpendSection";
import { usePoListController } from "./list/usePoListController";
import { PoPermissionGate } from "./PoPermissionGate";

export function PurchaseOrderList() {
  return (
    <PoPermissionGate permissions={[PO_PERMISSIONS.viewPage]} variant="list">
      <PurchaseOrderListBody />
    </PoPermissionGate>
  );
}

function PurchaseOrderListBody() {
  // VIEW_PAGE mở trang (gate ở trên); READ mới được gọi API dữ liệu (BE Action.java).
  const canRead = useCan(PO_PERMISSIONS.read);
  const canCreate = useCan(PO_PERMISSIONS.create);
  const c = usePoListController(canRead);
  const [activeTab, setActiveTab] = useUrlTab("tab", PO_LIST_TABS, "orders");

  return (
    <>
      <PoListHeader
        showStats={c.config.showStats}
        showStatsToggle={activeTab === "orders" && canRead}
        onToggleStats={() => c.updateConfig((x) => ({ ...x, showStats: !x.showStats }))}
        onCreate={canCreate ? () => c.router.push(ADMIN_ROUTES.purchaseOrders.create) : undefined}
      />
      <PoListTabs
        active={activeTab}
        orderCount={c.page?.totalElements ?? 0}
        onChange={setActiveTab}
      />
      {activeTab === "orders" ? <PoOrdersTab c={c} /> : <SupplierSpendSection canRead={canRead} />}
    </>
  );
}
