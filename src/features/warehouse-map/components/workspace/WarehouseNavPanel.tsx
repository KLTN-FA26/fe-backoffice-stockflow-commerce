"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Gauge, Warehouse as WarehouseIcon } from "lucide-react";

import {
  ADMIN_ROUTES,
  UI_LABELS,
  WAREHOUSE_CAPACITY_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { canEnterWarehouse, useAssignedWarehouses, usePermissionChecker } from "@/lib/auth";

import { prefixFromPath } from "@/features/warehouse-map/workspace";

import { ITEM_ACTIVE, ITEM_IDLE, NAV_ROW } from "@/components/backoffice/SidebarNavCollapsed";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

import { matchWorkspacePage, WORKSPACE_PAGES } from "./workspace-pages";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspacePage } from "./workspace-pages";

const W = UI_LABELS.warehouseMap.workspace;
const CATALOG = ADMIN_ROUTES.warehouses.list;
const CAPACITY = ADMIN_ROUTES.warehouseCapacity.list;

function Row({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(NAV_ROW, active ? ITEM_ACTIVE : ITEM_IDLE)}
      >
        <Link href={href} aria-current={active ? "page" : undefined}>
          <Icon className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">{children}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <SidebarMenuItem className="px-3 pt-2 pb-0.5">
      <p className="text-ink-tertiary text-[0.6875rem] font-medium">{children}</p>
    </SidebarMenuItem>
  );
}

/**
 * Màn con của tab "Kho & bản đồ" trên sidebar (thay danh sách item mặc định). Chọn kho ở trang Danh mục kho, không ở
 * sidebar: chưa vào kho nào → chỉ Danh mục kho, Bảng sức chứa + gợi ý; đang ở `/admin/warehouse-map/{prefix}/…` → các
 * trang của kho đó theo `WORKSPACE_PAGES`, chia nhóm Vận hành / Bản đồ (spec 2026-11-22 §5.6). Kho không được gán → bỏ
 * các trang `assignedOnly`, chỉ còn bản đồ (06: bản đồ không giới hạn theo kho được gán).
 */
export function WarehouseNavPanel() {
  const pathname = usePathname();
  const prefix = prefixFromPath(pathname, ADMIN_ROUTES.warehouseMap.root);
  const can = usePermissionChecker();
  const assigned = useAssignedWarehouses();
  const canCatalog = can(WAREHOUSE_PERMISSIONS.viewPage);
  const canCapacity = can(WAREHOUSE_CAPACITY_PERMISSIONS.viewPage);
  const pages = prefix
    ? WORKSPACE_PAGES.filter(
        (page) =>
          can(page.permission) && (!page.assignedOnly || canEnterWarehouse(assigned, prefix)),
      )
    : [];
  const rest = prefix ? pathname.split("/").slice(4) : [];
  const activePath = matchWorkspacePage(rest)?.path ?? (rest.length === 0 ? "" : null);
  const group = (key: WorkspacePage["group"]) => pages.filter((page) => page.group === key);
  const renderGroup = (key: WorkspacePage["group"]) => {
    const rows = group(key);
    if (!prefix || rows.length === 0) return null;
    return (
      <>
        <GroupTitle>{W.groups[key]}</GroupTitle>
        {rows.map((page) => (
          <Row
            key={page.path}
            href={ADMIN_ROUTES.warehouseMap.page(prefix, page.path)}
            active={activePath === page.path}
            icon={page.icon}
          >
            {page.label}
          </Row>
        ))}
      </>
    );
  };
  return (
    <>
      {!prefix && (
        <SidebarMenuItem className="px-3 pt-1 pb-1.5">
          <p className="text-ink-tertiary text-[0.6875rem] leading-snug">{W.pickHint}</p>
        </SidebarMenuItem>
      )}
      {renderGroup("operations")}
      {renderGroup("map")}
      {canCatalog && (
        <Row href={CATALOG} active={pathname.startsWith(CATALOG)} icon={WarehouseIcon}>
          {UI_LABELS.warehouseMap.listTitle}
        </Row>
      )}
      {/* Bảng sức chứa xem mọi kho (docs 06 §4.6) — không thuộc kho đang chọn nên luôn ở cuối, như Danh mục kho */}
      {canCapacity && (
        <Row href={CAPACITY} active={pathname.startsWith(CAPACITY)} icon={Gauge}>
          {UI_LABELS.warehouseCapacity.pageTitle}
        </Row>
      )}
    </>
  );
}
