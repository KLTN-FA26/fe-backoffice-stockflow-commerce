"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Gauge, Lightbulb, Map as MapIcon, Warehouse as WarehouseIcon } from "lucide-react";

import {
  ADMIN_ROUTES,
  UI_LABELS,
  WAREHOUSE_CAPACITY_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";

import { prefixFromPath } from "@/features/warehouse-map/workspace";

import { ITEM_ACTIVE, ITEM_IDLE, NAV_ROW } from "@/components/backoffice/SidebarNavCollapsed";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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

/**
 * Màn con của tab "Kho & bản đồ" trên sidebar (thay danh sách item mặc định). Chọn kho ở trang Danh mục
 * kho, không ở sidebar: chưa vào kho nào → chỉ Danh mục kho, Bảng sức chứa + gợi ý; đang ở `/admin/warehouse-map/
 * {prefix}/…` → các trang của kho đó (tên kho + đổi kho nằm trên breadcrumb).
 */
export function WarehouseNavPanel() {
  const pathname = usePathname();
  const prefix = prefixFromPath(pathname, ADMIN_ROUTES.warehouseMap.root);
  const canCatalog = useCan(WAREHOUSE_PERMISSIONS.viewPage);
  const canCapacity = useCan(WAREHOUSE_CAPACITY_PERMISSIONS.viewPage);
  const pages = prefix
    ? [
        { href: ADMIN_ROUTES.warehouseMap.of(prefix), label: W.pages.map, icon: MapIcon },
        {
          href: ADMIN_ROUTES.warehouseMap.slotting(prefix),
          label: W.pages.slotting,
          icon: Lightbulb,
        },
      ]
    : [];
  return (
    <>
      {!prefix && (
        <SidebarMenuItem className="px-3 pt-1 pb-1.5">
          <p className="text-ink-tertiary text-[0.6875rem] leading-snug">{W.pickHint}</p>
        </SidebarMenuItem>
      )}
      {pages.map((page) => (
        <Row key={page.href} href={page.href} active={pathname === page.href} icon={page.icon}>
          {page.label}
        </Row>
      ))}
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
