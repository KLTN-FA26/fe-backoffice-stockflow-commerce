"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  SUPPLIER_ITEM_PERMISSIONS,
  SUPPLIER_ITEM_UI_LABELS,
  SUPPLIER_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useSupplier } from "@/features/supplier";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { SupplierItemsTab } from "./supplier-detail/items/SupplierItemsTab";
import { SupplierProfileTab } from "./supplier-detail/SupplierProfileTab";
import { SupplierLoadError } from "./SupplierLoadError";
import { SupplierPermissionGate } from "./SupplierPermissionGate";

const L = SUPPLIER_ITEM_UI_LABELS;
const TABS = ["profile", "items"] as const;
const TAB_ITEMS = [
  { value: "profile", label: L.tabProfile },
  { value: "items", label: L.tabTitle },
] as const;
// Tab + khoá danh sách của tab danh mục (`useSupplierItemsState`) — đổi tab thì xoá cả bộ
const URL_PARSERS = {
  tab: parseAsStringLiteral(TABS).withDefault("profile"),
  itemPage: parseAsInteger,
  itemSort: parseAsString,
};

function SupplierDetailContent({ supplierId }: { supplierId: string }) {
  const can = usePermissionChecker();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = can(SUPPLIER_PERMISSIONS.read);
  // UI-only — Backend phải re-check (@RequiresPermission procurement-supplier-items)
  const canReadItems = can(SUPPLIER_ITEM_PERMISSIONS.read);
  const [url, setUrl] = useQueryStates(URL_PARSERS);
  // Thiếu quyền đọc danh mục: `?tab=items` rơi về Hồ sơ và không gọi `/items`
  const tab = canReadItems ? url.tab : "profile";
  const query = useSupplier(supplierId, { enabled: canRead });
  // Breadcrumb hiện mã NCC thay vì supplierId (UUID của BE)
  useBreadcrumbLabel(supplierId, query.data?.code);

  if (!canRead) return <SupplierLoadError error={null} kind="no-read" />;
  // React Query v5 giữ `data` khi refetch nền lỗi — chỉ báo lỗi khi chưa có data, kẻo gỡ cả trang
  // (tab, dialog thêm / sửa SKU đang mở) giữa chừng.
  if (query.isError && !query.data) {
    return <SupplierLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    // Offline → query bị pause; đang retry → vẫn là skeleton. Chỉ 404 mới là "không tìm thấy".
    if (query.fetchStatus === "paused") {
      return <SupplierLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }

  const supplier = query.data;
  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có mã NCC và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{supplier.name}</h1>
      {canReadItems && (
        <PageTabs
          tabs={TAB_ITEMS}
          value={tab}
          onChange={(next) =>
            void setUrl({ tab: next === "profile" ? null : next, itemPage: null, itemSort: null })
          }
          idPrefix="supplier-detail"
          ariaLabel={L.tabsAria}
        />
      )}
      {/* Không có tablist (thiếu quyền danh mục) thì không bọc tabpanel — tránh aria-labelledby treo */}
      {canReadItems ? (
        <PageTabPanel idPrefix="supplier-detail" value={tab}>
          {tab === "items" ? (
            <SupplierItemsTab supplier={supplier} />
          ) : (
            <SupplierProfileTab supplier={supplier} can={can} />
          )}
        </PageTabPanel>
      ) : (
        <SupplierProfileTab supplier={supplier} can={can} />
      )}
    </div>
  );
}

export function SupplierDetail({ id }: { id: string }) {
  return (
    <SupplierPermissionGate permissions={[SUPPLIER_PERMISSIONS.viewPage]}>
      <SupplierDetailContent supplierId={id} />
    </SupplierPermissionGate>
  );
}
