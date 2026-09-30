"use client";

import { ADMIN_ROUTES } from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PO_LIST_TABS, PoListHeader, PoListTabs } from "./list/PoListHeader";
import { PoOrdersTab } from "./list/PoOrdersTab";
import { SupplierSpendSection } from "./list/SupplierSpendSection";
import { usePoListController } from "./list/usePoListController";

export function PurchaseOrderList() {
  const c = usePoListController();
  const [activeTab, setActiveTab] = useUrlTab("tab", PO_LIST_TABS, "orders");

  if (c.isLoading) return <PageSkeleton variant="list" />;

  return (
    <>
      <PoListHeader
        showStats={c.config.showStats}
        showStatsToggle={activeTab === "orders"}
        onToggleStats={() => c.updateConfig((x) => ({ ...x, showStats: !x.showStats }))}
        onCreate={() => c.router.push(ADMIN_ROUTES.purchaseOrders.create)}
      />
      <PoListTabs active={activeTab} orderCount={c.total} onChange={setActiveTab} />
      {activeTab === "orders" ? <PoOrdersTab c={c} /> : <SupplierSpendSection />}
    </>
  );
}
