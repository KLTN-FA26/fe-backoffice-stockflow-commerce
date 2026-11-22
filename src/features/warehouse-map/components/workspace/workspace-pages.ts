import { Lightbulb, Map as MapIcon, PackageCheck, PackageSearch, Undo2 } from "lucide-react";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_PICKING_PERMISSIONS,
  PUT_BACK_LABELS,
  PUTAWAY_TASK_PERMISSIONS,
  UI_LABELS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WORKSPACE_PATHS,
} from "@/constants";

import type { LucideIcon } from "lucide-react";
import type { PermissionCode } from "@/lib/auth";

const W = UI_LABELS.warehouseMap.workspace;

/** Một trang trong tab theo kho — nguồn chung của panel sidebar, breadcrumb và quyền thấy tab (spec 2026-11-22 §5.6). */
export interface WorkspacePage {
  /** Đoạn sau `/admin/warehouse-map/{prefix}` (`WORKSPACE_PATHS`); `""` là bản đồ. */
  path: string;
  group: "operations" | "map";
  label: string;
  icon: LucideIcon;
  permission: PermissionCode;
  /** Trang nằm trong route group `(operations)` — chỉ mở ở kho được gán (docs 05/07/08/11/20). */
  assignedOnly: boolean;
}

/** Thứ tự = thứ tự hiện trên panel (Vận hành theo spec §5.6, rồi Bản đồ). Mỗi màn chuyển vào tab thêm một dòng. */
export const WORKSPACE_PAGES: readonly WorkspacePage[] = [
  {
    path: WORKSPACE_PATHS.picking,
    group: "operations",
    label: W.pages.picking,
    icon: PackageSearch,
    // BE fulfillment pick lists (docs 07) — NV kho lấy hàng, quản lý kho giao task
    permission: FULFILLMENT_PICK_PERMISSIONS.viewPage,
    assignedOnly: true,
  },
  {
    path: WORKSPACE_PATHS.packing,
    group: "operations",
    label: UI_LABELS.cartonCheck.navTitle,
    icon: PackageCheck,
    // BE fulfillment packages (docs 08) — trạm kiểm thùng
    permission: FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
    assignedOnly: true,
  },
  {
    path: WORKSPACE_PATHS.putBacks,
    group: "operations",
    label: PUT_BACK_LABELS.title,
    icon: Undo2,
    // BE `GET /fulfillment/put-backs` — fulfillment-picking:READ (resource không có VIEW_PAGE)
    permission: FULFILLMENT_PICKING_PERMISSIONS.read,
    assignedOnly: true,
  },
  {
    path: "",
    group: "map",
    label: W.pages.map,
    icon: MapIcon,
    // BE WarehouseLocationResourceDeclaration route `/admin/warehouse-map`
    permission: WAREHOUSE_LOCATION_PERMISSIONS.viewPage,
    assignedOnly: false,
  },
  {
    path: WORKSPACE_PATHS.slotting,
    group: "map",
    label: W.pages.slotting,
    icon: Lightbulb,
    // Đọc bin gợi ý của nhiệm vụ cất hàng (`GET /putaway-tasks/{id}`) — nhiệm vụ cất hàng giới hạn theo kho (05)
    permission: PUTAWAY_TASK_PERMISSIONS.viewPage,
    assignedOnly: true,
  },
];

/** Thấy tab khi có quyền ít nhất một trang trong kho. */
export const WORKSPACE_PERMISSIONS: readonly PermissionCode[] = WORKSPACE_PAGES.map(
  (page) => page.permission,
);

/** Trang (dài nhất) khớp phần đường dẫn sau prefix — `["picking", "t-1"]` → trang `picking`. */
export function matchWorkspacePage(rest: readonly string[]): WorkspacePage | undefined {
  const path = rest.join("/");
  return [...WORKSPACE_PAGES]
    .filter((page) => page.path !== "" && (path === page.path || path.startsWith(`${page.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
