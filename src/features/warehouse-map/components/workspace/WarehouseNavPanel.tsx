"use client";

import { Fragment } from "react";
import { Gauge, Warehouse as WarehouseIcon } from "lucide-react";

import {
  ADMIN_ROUTES,
  UI_LABELS,
  WAREHOUSE_CAPACITY_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { canEnterWarehouse, useAssignedWarehouses, usePermissionChecker } from "@/lib/auth";

import { usePanelWarehouse } from "./use-panel-warehouse";
import { NavGroupTitle, NavRow, PickWarehouseHint } from "./WarehouseNavParts";
import { matchWorkspacePage, WORKSPACE_PAGES } from "./workspace-pages";

import type { WorkspacePage } from "./workspace-pages";

const W = UI_LABELS.warehouseMap.workspace;
const CATALOG = ADMIN_ROUTES.warehouses.list;
const CAPACITY = ADMIN_ROUTES.warehouseCapacity.list;
const GROUPS: readonly WorkspacePage["group"][] = ["operations", "map"];

/**
 * Màn con của tab "Kho" trên sidebar (thay danh sách item mặc định). Chọn kho ở trang Danh mục kho, không ở sidebar.
 * Kho của panel theo `usePanelWarehouse` (URL, không có thì kho mở gần nhất) — sang Danh mục kho / Sức chứa kho panel
 * KHÔNG đổi, link Vận hành / Bản đồ vẫn trỏ về kho đó.
 * Chưa từng vào kho → gợi ý + nhóm "Tất cả kho". Kho không được gán → bỏ trang `assignedOnly`, chỉ còn bản đồ (06).
 */
export function WarehouseNavPanel() {
  const { pathname, urlPrefix, prefix } = usePanelWarehouse();
  const can = usePermissionChecker();
  const assigned = useAssignedWarehouses();
  const pages = prefix
    ? WORKSPACE_PAGES.filter(
        (page) =>
          can(page.permission) && (!page.assignedOnly || canEnterWarehouse(assigned, prefix)),
      )
    : [];
  // Trang đang mở chỉ tính khi URL ở trong kho — ở Danh mục kho thì không dòng nào của kho sáng (kể cả Bản đồ kho)
  const rest = urlPrefix ? pathname.split("/").slice(4) : null;
  const activePath = rest
    ? (matchWorkspacePage(rest)?.path ?? (rest.length === 0 ? "" : null))
    : null;
  const canCatalog = can(WAREHOUSE_PERMISSIONS.viewPage);
  const canCapacity = can(WAREHOUSE_CAPACITY_PERMISSIONS.viewPage);
  return (
    <>
      {/* Tên + prefix kho nằm ở dòng tiêu đề panel (`WarehouseNavTitle`) */}
      {!prefix && <PickWarehouseHint />}
      {prefix &&
        GROUPS.map((key) => {
          const rows = pages.filter((page) => page.group === key);
          if (rows.length === 0) return null;
          return (
            <Fragment key={key}>
              <NavGroupTitle>{W.groups[key]}</NavGroupTitle>
              {rows.map((page) => (
                <NavRow
                  key={page.path}
                  href={ADMIN_ROUTES.warehouseMap.page(prefix, page.path)}
                  active={activePath === page.path}
                  icon={page.icon}
                >
                  {page.label}
                </NavRow>
              ))}
            </Fragment>
          );
        })}
      {/* Trang xem mọi kho (docs 06 §4.6) — không thuộc kho đang làm việc nên tách nhóm riêng, có vạch ngăn */}
      {(canCatalog || canCapacity) && (
        <NavGroupTitle divided={Boolean(prefix)}>{W.groups.all}</NavGroupTitle>
      )}
      {canCatalog && (
        <NavRow href={CATALOG} active={pathname.startsWith(CATALOG)} icon={WarehouseIcon}>
          {UI_LABELS.warehouseMap.listTitle}
        </NavRow>
      )}
      {canCapacity && (
        <NavRow href={CAPACITY} active={pathname.startsWith(CAPACITY)} icon={Gauge}>
          {UI_LABELS.warehouseCapacity.pageTitle}
        </NavRow>
      )}
    </>
  );
}
