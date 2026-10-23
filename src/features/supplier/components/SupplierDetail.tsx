"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import {
  ADMIN_ROUTES,
  SUPPLIER_ITEM_PERMISSIONS,
  SUPPLIER_ITEM_UI_LABELS,
  SUPPLIER_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useSupplier } from "@/features/supplier";
import { PageHeader } from "@/components/shared/PageHeader";
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
    <>
      <PageHeader
        title={supplier.name}
        subtitle={`${supplier.code} — hồ sơ nhà cung cấp`}
        actions={
          <Link
            href={ADMIN_ROUTES.suppliers.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Quay lại
          </Link>
        }
      />
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
    </>
  );
}

export function SupplierDetail({ id }: { id: string }) {
  return (
    <SupplierPermissionGate permissions={[SUPPLIER_PERMISSIONS.viewPage]}>
      <SupplierDetailContent supplierId={id} />
    </SupplierPermissionGate>
  );
}
