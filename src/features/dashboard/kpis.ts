import { ArrowRightLeft, ClipboardList, PackageCheck, Receipt, ShoppingCart } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import {
  DASHBOARD_API,
  DASHBOARD_LABELS,
  DASHBOARD_ORDER_PENDING_FILTER,
  DASHBOARD_ORDER_PENDING_STATUSES,
  DASHBOARD_PICK_OPEN_STATUSES,
  DASHBOARD_PO_PENDING_STATUSES,
  DASHBOARD_RECEIPT_PROCESSING_STATUSES,
  DASHBOARD_TRANSFER_IN_TRANSIT_STATUSES,
} from "@/constants/dashboard";
import {
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  TRANSFER_PERMISSIONS,
} from "@/constants/permissions";

import type { LucideIcon } from "lucide-react";
import type { PermissionCode } from "@/lib/auth";
import type { CountSource } from "./types";

/** Danh sách đơn lọc sẵn theo `?status=` (nuqs: giá trị cách nhau bằng dấu phẩy). */
function orderListHref(statuses: readonly string[]): string {
  return `${ADMIN_ROUTES.orders.list}?status=${statuses.map(encodeURIComponent).join(",")}`;
}

export interface KpiDefinition {
  key: string;
  label: string;
  icon: LucideIcon;
  /** BE `@RequiresPermission` of the list endpoint the number comes from. */
  permission: PermissionCode;
  source: CountSource;
  href: string;
}

// One entry per module that has a real list endpoint. Shipment exceptions have none (BE SCRUM-288),
// so there is no tile for them — a number would have to be invented.
export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    key: "orders",
    label: DASHBOARD_LABELS.ordersPending,
    icon: ClipboardList,
    permission: ORDER_PERMISSIONS.read,
    source: {
      path: DASHBOARD_API.orders,
      statuses: DASHBOARD_ORDER_PENDING_STATUSES,
      repeatStatus: true,
    },
    // Cùng tập trạng thái tile đang đếm → bấm vào thấy đúng những đơn đó
    href: orderListHref(DASHBOARD_ORDER_PENDING_FILTER),
  },
  {
    key: "purchase-orders",
    label: DASHBOARD_LABELS.poPending,
    icon: ShoppingCart,
    permission: PO_PERMISSIONS.read,
    source: {
      path: DASHBOARD_API.purchaseOrders,
      statuses: DASHBOARD_PO_PENDING_STATUSES,
      repeatStatus: true,
    },
    href: ADMIN_ROUTES.purchaseOrders.list,
  },
  {
    key: "receipts",
    label: DASHBOARD_LABELS.receiptsProcessing,
    icon: Receipt,
    permission: GOODS_RECEIPT_PERMISSIONS.read,
    source: {
      path: DASHBOARD_API.receipts,
      statuses: DASHBOARD_RECEIPT_PROCESSING_STATUSES,
      repeatStatus: true,
    },
    href: ADMIN_ROUTES.receipts.list,
  },
  {
    key: "picks",
    label: DASHBOARD_LABELS.picksOpen,
    icon: PackageCheck,
    permission: FULFILLMENT_PICK_PERMISSIONS.read,
    source: {
      path: DASHBOARD_API.pickTasks,
      statuses: DASHBOARD_PICK_OPEN_STATUSES,
      repeatStatus: false,
    },
    href: ADMIN_ROUTES.picking.list,
  },
  {
    key: "transfers",
    label: DASHBOARD_LABELS.transfersInTransit,
    icon: ArrowRightLeft,
    permission: TRANSFER_PERMISSIONS.read,
    source: {
      path: DASHBOARD_API.transfers,
      statuses: DASHBOARD_TRANSFER_IN_TRANSIT_STATUSES,
      repeatStatus: true,
    },
    href: ADMIN_ROUTES.transfers.list,
  },
];
