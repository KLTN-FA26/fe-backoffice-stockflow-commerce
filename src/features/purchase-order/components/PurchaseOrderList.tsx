"use client";

import { ADMIN_ROUTES, PO_PERMISSIONS } from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";
import { useCan } from "@/lib/auth";
import { PageTabPanel } from "@/components/shared/PageTabs";

import {
  PO_LIST_TAB_ID_PREFIX,
  PO_LIST_TABS,
  PoListActions,
  PoListTabs,
} from "./list/PoListHeader";
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
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; nút tạo / thống kê nằm cuối toolbar của tab Đơn đặt hàng.
    <div className="surface-soft">
      <h1 className="sr-only">Đơn đặt NCC</h1>
      <PoListTabs
        active={activeTab}
        orderCount={c.page?.totalElements ?? 0}
        onChange={setActiveTab}
      />
      {/* Cùng `idPrefix` với `PoListTabs` để `aria-controls` của tab trỏ đúng vùng nội dung */}
      <PageTabPanel idPrefix={PO_LIST_TAB_ID_PREFIX} value={activeTab}>
        {activeTab === "orders" ? (
          <PoOrdersTab
            c={c}
            actions={
              <PoListActions
                showStats={c.config.showStats}
                showStatsToggle={canRead}
                onToggleStats={() => c.updateConfig((x) => ({ ...x, showStats: !x.showStats }))}
                onCreate={
                  canCreate ? () => c.router.push(ADMIN_ROUTES.purchaseOrders.create) : undefined
                }
              />
            }
          />
        ) : (
          <SupplierSpendSection canRead={canRead} />
        )}
      </PageTabPanel>
    </div>
  );
}
