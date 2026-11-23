import { ClipboardCheck, Lightbulb, Map as MapIcon, Move, PackageCheck, Route } from "lucide-react";

import {
  INVENTORY_PERMISSIONS,
  PUTAWAY_LABELS,
  PUTAWAY_TASK_PERMISSIONS,
  PUTAWAY_TRIP_LABELS,
  PUTAWAY_TRIP_PERMISSIONS,
  UI_LABELS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WORKSPACE_PATHS,
} from "@/constants";

import { CYCLE_COUNT_LABELS } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

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
    path: WORKSPACE_PATHS.putaway,
    group: "operations",
    label: PUTAWAY_LABELS.title,
    icon: PackageCheck,
    // BE `PutawayController`, resource warehouse-putaway-tasks (docs 05)
    permission: PUTAWAY_TASK_PERMISSIONS.viewPage,
    assignedOnly: true,
  },
  {
    path: WORKSPACE_PATHS.myTrip,
    group: "operations",
    label: PUTAWAY_TRIP_LABELS.title,
    icon: Route,
    // BE `PutawayTripController`, resource warehouse-putaway-trips (docs 05 §4.5)
    permission: PUTAWAY_TRIP_PERMISSIONS.viewPage,
    assignedOnly: true,
  },
  {
    path: WORKSPACE_PATHS.moves,
    group: "operations",
    label: W.pages.moves,
    icon: Move,
    // BE StockOperationsController: POST /inventory/movements là inventory-stock-items:UPDATE (docs 11)
    permission: INVENTORY_PERMISSIONS.stockUpdate,
    assignedOnly: true,
  },
  {
    path: WORKSPACE_PATHS.cycleCounts,
    group: "operations",
    label: CYCLE_COUNT_LABELS.title,
    icon: ClipboardCheck,
    // BE CycleCountController: resource inventory-cycle-counts (NV kho đếm, quản lý kho duyệt / đếm lại)
    permission: CYCLE_COUNT_PERMISSIONS.viewPage,
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
