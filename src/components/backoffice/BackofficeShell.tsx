"use client";

import { cn } from "cn";
import {
  Ban,
  Banknote,
  Building2,
  Boxes,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileBox,
  FileInput,
  FileSignature,
  ChartColumn,
  MessageSquareText,
  MessagesSquare,
  FileText,
  FlaskConical,
  Gauge,
  FolderTree,
  History as HistoryIcon,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Package,
  PackageOpen,
  PackagePlus,
  Palette,
  Handshake,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  RadioTower,
  ReceiptText,
  Search as SearchIcon,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Settings,
  TableProperties,
  PackageX,
  SlidersHorizontal,
  Tag,
  Tags,
  Truck,
  TruckElectric,
  Undo2,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ADMIN_ROUTES,
  ATTRIBUTE_PERMISSIONS,
  BRAND,
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  DESIGN_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_LABELS,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
  DELIVERY_FAILURE_LABELS,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  LOAD_ESTIMATE_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_PRINT_LABELS,
  NAV_GROUP_LABELS,
  ORDER_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  QUOTE_PERMISSIONS,
  CHAT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  STANDARD_PRICE_PERMISSIONS,
  STANDARD_PRICE_UI_LABELS,
  STOCK_PACKAGE_PERMISSIONS,
  TRIAL_LABELS,
  UI_LABELS,
  VEHICLE_TYPE_PERMISSIONS,
  WAREHOUSE_CAPACITY_PERMISSIONS,
  PRODUCER_PERMISSIONS,
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_SCHEDULE_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { QUARANTINE_LABELS } from "@/constants/quarantine";
import {
  EINVOICE_PERMISSIONS,
  EINVOICE_ROUTES,
  EINVOICE_SETTINGS_PERMISSIONS,
} from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { PAYMENT_LABELS, RECEIVABLES_LABELS } from "@/constants/labels-payment";
import { PRINT_CONFIG_PAGE_LABELS } from "@/constants/labels-print-config";
import { PRINT_CONFIG_SEGMENT } from "@/constants/routes";
import { RETURN_LABELS, RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
  PAYMENT_ROUTES,
  RECEIVABLES_REPORT_PERMISSIONS,
} from "@/constants/payment";
import { RETURN_ROUTES, RMA_PERMISSIONS } from "@/constants/returns";

import { useStaffChatBadge } from "@/features/chat";
import { NotificationBell } from "@/features/notification";
import { warehouseBreadcrumbTail } from "@/features/warehouse-map/components/workspace/WarehouseCrumb";
import { WarehouseNavPanel } from "@/features/warehouse-map/components/workspace/WarehouseNavPanel";
import { WarehouseNavTitle } from "@/features/warehouse-map/components/workspace/WarehouseNavParts";
import { WORKSPACE_PERMISSIONS } from "@/features/warehouse-map/components/workspace/workspace-pages";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useAppStore } from "@/lib/store/use-app-store";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";

import { notificationItemAction } from "@/components/backoffice/notification-item-action";
import { Logo } from "@/components/shared/Logo";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { SidebarFooterBar } from "./SidebarFooterBar";
import { SidebarNav } from "./SidebarNav";

import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { PermissionCode } from "@/lib/auth/me-permissions";
/* -------------------------------------------------------------------------- */
/*  Sidebar nav config                                                       */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Mã quyền BE cần có để thấy menu (đọc từ /identity/me/permissions). Không khai báo = luôn hiện. */
  permission?: PermissionCode;
  /** Thấy menu khi có ít nhất một mã trong danh sách (màn mở bằng nhiều quyền khác nhau). */
  anyPermission?: readonly PermissionCode[];
  /**
   * Ẩn mục khi người dùng CÓ mã này — mục được đặt ở nhóm khác cho họ (vd "Đơn hàng" của Sale nằm ở "Bán hàng", L-6),
   * để một trang không hiện hai lần trong menu và nhóm đang mở luôn là nhóm của vai trò.
   */
  unlessPermission?: PermissionCode;
  /** Breadcrumb riêng cho các đoạn URL sau `href` (vd `[kho ⇅] / Bản đồ kho`) thay cách đọc id mặc định. */
  breadcrumbTail?: (
    rest: readonly string[],
    labelFor: (id: string) => string | undefined,
  ) => BreadcrumbItem[];
  /** Route anh em chia chung mục menu này (vd tab "Dự án"): sáng menu và breadcrumb theo mục. */
  matchPrefixes?: readonly string[];
}

export interface NavGroup {
  /** Tên item cha trong sidebar. */
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Màn con riêng thay danh sách item mặc định (vd tab "Kho": chọn kho → trang của kho). */
  panel?: ComponentType;
  /** Nội dung dòng tiêu đề (nút quay lại) của màn con — mặc định là `title` (vd tab "Kho": tên + prefix kho đang làm việc). */
  panelTitle?: ComponentType;
  /** Bấm item cha thì đi thẳng tới trang này (thay vì chỉ mở màn con). */
  href?: string;
}

export const NAV_GROUPS: NavGroup[] = [
  // Thứ tự theo luồng end-to-end của docs 00 §4: sản phẩm → thiết kế → bán → đơn → sản xuất → nhập → kho → giao → thu tiền
  {
    title: NAV_GROUP_LABELS.overview,
    icon: LayoutDashboard,
    items: [{ label: NAV_GROUP_LABELS.overview, href: ADMIN_ROUTES.home, icon: LayoutDashboard }],
  },
  {
    // Dữ liệu sản phẩm (docs 01)
    title: NAV_GROUP_LABELS.product,
    icon: Package,
    items: [
      {
        label: "Sản phẩm & SKU",
        href: ADMIN_ROUTES.products.list,
        icon: Package,
        permission: PRODUCT_PERMISSIONS.viewPage,
      },
      {
        label: "Từ điển thuộc tính",
        href: ADMIN_ROUTES.attributes,
        icon: Palette,
        permission: ATTRIBUTE_PERMISSIONS.viewPage,
      },
      {
        label: "Thương hiệu & danh mục",
        href: ADMIN_ROUTES.taxonomy.list,
        icon: FolderTree,
        // BE gate mọi endpoint /brands, /categories bằng product-products (ProductTaxonomyController)
        permission: PRODUCT_PERMISSIONS.viewPage,
      },
      {
        label: "Hồ sơ hàng tồn",
        href: ADMIN_ROUTES.inventoryItems.list,
        // Hồ sơ cấu hình SKU — khác icon Boxes của "Tổng quan tồn kho" (số lượng tồn)
        icon: FileBox,
        // Quy cách thùng & logistics của SKU — dữ liệu sản phẩm (docs 01 §4.7), Quản lý kho khai báo
        // Route BE khai báo cho resource inventory-inventory-items (PR #119)
        permission: INVENTORY_ITEM_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    // Quản lý thiết kế (docs 12): duyệt bản khách gửi, yêu cầu báo giá từ bản thiết kế (§4.8)
    title: NAV_GROUP_LABELS.design,
    icon: PenTool,
    items: [
      {
        label: "Duyệt thiết kế",
        href: ADMIN_ROUTES.designs.reviewQueue,
        icon: ClipboardCheck,
        // `design-designs:APPROVE` (PRODUCTION_COORDINATOR, SYSTEM_ADMIN; V20261213000200) — không dùng VIEW_PAGE: SALES_STAFF cũng có, sẽ bị 403
        permission: DESIGN_PERMISSIONS.approve,
        matchPrefixes: [ADMIN_ROUTES.designReviewRounds.list],
      },
      {
        label: DESIGN_QUOTE_REQUEST_LABELS.navLabel,
        href: ADMIN_ROUTES.designQuoteRequests.list,
        icon: FileInput,
        // BE `design-quote-requests:VIEW_PAGE` (SALES_STAFF, SALES_MANAGER); hai route (đơn lẻ / dự án) chia mục này
        permission: DESIGN_QUOTE_REQUEST_PERMISSIONS.viewPage,
        matchPrefixes: [ADMIN_ROUTES.designProjectQuoteRequests.list],
      },
    ],
  },
  {
    // Bán hàng sỉ: khách (18), bảng giá nội bộ (13 §4.2), báo giá (14), chat (16)
    title: NAV_GROUP_LABELS.sales,
    icon: Building2,
    items: [
      {
        label: "Khách hàng",
        href: ADMIN_ROUTES.customers.list,
        icon: Building2,
        permission: CUSTOMER_PERMISSIONS.viewPage,
      },
      {
        label: CUSTOMER_PRICE_UI_LABELS.navLabel,
        href: ADMIN_ROUTES.customerPrices.list,
        icon: Tags,
        // BE `@PermissionResource(catalog-customer-prices)`: VIEW_PAGE mở trang (seed: ECOMMERCE_ADMIN, SALES_STAFF)
        permission: CUSTOMER_PRICE_PERMISSIONS.viewPage,
      },
      {
        label: STANDARD_PRICE_UI_LABELS.navLabel,
        href: ADMIN_ROUTES.standardPrices.list,
        icon: Tag,
        // BE `@PermissionResource(catalog-standard-prices)`: VIEW_PAGE (seed: SALES_MANAGER, SALES_STAFF, SYSTEM_ADMIN)
        permission: STANDARD_PRICE_PERMISSIONS.viewPage,
      },
      {
        label: "Báo giá",
        href: ADMIN_ROUTES.quotes.list,
        icon: FileSignature,
        permission: QUOTE_PERMISSIONS.viewPage,
      },
      // L-6: Sale đi báo giá → hợp đồng → đơn trong cùng nhóm; mở chi tiết đơn (`/admin/orders/[id]`) vẫn sáng nhóm này
      // thay vì nhảy sang nhóm "Đơn hàng". Gate: xem được đơn VÀ làm báo giá (vai trò bán hàng).
      {
        label: UI_LABELS.order.pageTitle,
        href: ADMIN_ROUTES.orders.list,
        icon: ClipboardList,
        permission: ORDER_PERMISSIONS.viewPage,
        anyPermission: [QUOTE_PERMISSIONS.viewPage],
      },
      {
        label: "Chat với khách",
        href: ADMIN_ROUTES.chat.list,
        icon: MessagesSquare,
        // BE `chat-conversations:VIEW_PAGE` (seed: SALES_STAFF, SALES_MANAGER, SYSTEM_ADMIN)
        permission: CHAT_PERMISSIONS.viewPage,
      },
      {
        label: "Câu trả lời mẫu",
        href: ADMIN_ROUTES.chat.canned,
        icon: MessageSquareText,
        permission: CHAT_PERMISSIONS.cannedViewPage,
      },
      {
        label: "Báo cáo chat",
        href: ADMIN_ROUTES.chat.agentsReport,
        icon: ChartColumn,
        // Chỉ người giám sát chat (SALES_MANAGER, SYSTEM_ADMIN): BE `chat-supervision:READ`
        permission: CHAT_PERMISSIONS.superviseRead,
      },
    ],
  },
  {
    // Quản lý đơn hàng (docs 17): đơn, yêu cầu huỷ (§4.8), giao thất bại, trả hàng (§4.10)
    title: NAV_GROUP_LABELS.order,
    icon: ListChecks,
    items: [
      {
        label: UI_LABELS.order.pageTitle,
        href: ADMIN_ROUTES.orders.list,
        icon: ClipboardList,
        permission: ORDER_PERMISSIONS.viewPage,
        // Người làm báo giá thấy "Đơn hàng" ở nhóm "Bán hàng" (L-6) — không hiện lần hai ở đây
        unlessPermission: QUOTE_PERMISSIONS.viewPage,
      },
      // Hàng đợi yêu cầu huỷ của khách: resource `sales-order-cancellations` không có VIEW_PAGE (chỉ READ / UPDATE) nên
      // gate bằng READ — seed BE: SALES_STAFF + SYSTEM_ADMIN.
      {
        label: CANCELLATION_REQUEST_LABELS.title,
        href: ADMIN_ROUTES.orders.cancellationRequests,
        icon: Ban,
        permission: CANCELLATION_REQUEST_PERMISSIONS.read,
      },
      // Lô hàng hoàn về (WF-05 BO-01): lịch sử lô hãng mang về — BE `GET /orders/delivery-failures` đòi sales-orders:READ
      {
        label: DELIVERY_FAILURE_LABELS.title,
        href: ADMIN_ROUTES.orders.deliveryFailures,
        icon: PackageX,
        permission: ORDER_PERMISSIONS.read,
      },
      // Yêu cầu trả hàng (docs 17 §4.10) — `sales-rmas:VIEW_PAGE`: Sale, Kế toán, Kho, Quản trị (WF-05 BO-16)
      {
        label: RETURN_LABELS.navLabel,
        href: RETURN_ROUTES.list,
        icon: Undo2,
        permission: RMA_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    // Sản xuất theo đơn bán (docs 17 §4.3, §4.12): lịch → lập Đơn sản xuất từ đợt còn thiếu → theo dõi tới nhập kho
    title: PRODUCTION_LABELS.navGroup,
    icon: Factory,
    items: [
      {
        label: PRODUCTION_LABELS.schedule.pageTitle,
        href: ADMIN_ROUTES.productionSchedule,
        icon: CalendarRange,
        // BE ProductionScheduleController route `/production/schedule`: Điều phối SX, Sale, QLKD, Quản lý kho
        permission: PRODUCTION_SCHEDULE_PERMISSIONS.viewPage,
      },
      {
        label: PRODUCTION_LABELS.order.pageTitle,
        href: ADMIN_ROUTES.productionOrders.list,
        icon: ClipboardList,
        // BE ProductionOrderController route `/production/orders`
        permission: PRODUCTION_ORDER_PERMISSIONS.viewPage,
      },
      {
        label: PRODUCTION_LABELS.producer.pageTitle,
        href: ADMIN_ROUTES.producers,
        icon: Handshake,
        // BE ProducerController route `/production/producers`
        permission: PRODUCER_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    // Nhập kho thành phẩm (docs 03): phiếu theo Đơn sản xuất (§4.1) và phiếu hàng hoàn (§4.2)
    title: NAV_GROUP_LABELS.receiving,
    icon: PackagePlus,
    items: [
      {
        label: "Phiếu nhận",
        href: ADMIN_ROUTES.receipts.list,
        icon: FileText,
        permission: GOODS_RECEIPT_PERMISSIONS.viewPage,
      },
      // Phiếu nhập hàng hoàn (docs 03 §4.2, BR-14) — phiếu nhận loại RETURN, cùng quyền phiếu nhận (WF-05 BO-16)
      {
        label: RETURN_RECEIPT_LABELS.navLabel,
        href: RETURN_ROUTES.receipts.list,
        icon: PackageOpen,
        permission: GOODS_RECEIPT_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    // Module 06 tách tab riêng: luôn chọn kho làm việc trước (panel riêng), trang theo kho dưới prefix
    title: UI_LABELS.warehouseMap.workspace.navGroup,
    icon: MapPin,
    // Gốc tab: được gán đúng một kho → vào thẳng kho đó; còn lại → Danh mục kho (spec 2026-11-22 §5.3)
    href: ADMIN_ROUTES.warehouseMap.root,
    panel: WarehouseNavPanel,
    panelTitle: WarehouseNavTitle,
    items: [
      {
        label: UI_LABELS.warehouseMap.listTitle,
        href: ADMIN_ROUTES.warehouses.list,
        icon: WarehouseIcon,
        // BE WarehouseController @PermissionResource route `/admin/warehouses`
        permission: WAREHOUSE_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.warehouseMap.workspace.navGroup,
        href: ADMIN_ROUTES.warehouseMap.root,
        icon: MapIcon,
        // Thấy tab khi được vào ít nhất một trang của kho (bản đồ, gợi ý vị trí, màn vận hành — spec 2026-11-22 §5.6)
        anyPermission: WORKSPACE_PERMISSIONS,
        breadcrumbTail: warehouseBreadcrumbTail,
      },
      {
        label: UI_LABELS.warehouseCapacity.pageTitle,
        href: ADMIN_ROUTES.warehouseCapacity.list,
        icon: Gauge,
        // BE WarehouseCapacityController (resource `warehouse-capacity`): Quản lý kho, Sale, Điều phối SX, QLKD
        permission: WAREHOUSE_CAPACITY_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    // Kiểm soát tồn (docs 20) — kiểm kê, di chuyển nội bộ (11) nằm trong tab theo kho
    title: NAV_GROUP_LABELS.inventory,
    icon: Boxes,
    items: [
      {
        label: INVENTORY_LABELS.overviewTitle,
        href: INVENTORY_ROUTES.overview,
        icon: Boxes,
        // Same rule as the page gate: stock READ or reservation READ.
        anyPermission: [
          INVENTORY_OVERVIEW_PERMISSIONS.stockRead,
          INVENTORY_OVERVIEW_PERMISSIONS.reservationRead,
        ],
      },
      // Di chuyển nội bộ (docs 11) đã vào tab "Kho" — làm việc theo một kho (spec 2026-11-22)
      // Kiểm kê (docs 20) đã vào tab "Kho" — làm việc theo một kho (spec 2026-11-22)
      {
        label: "Điều chỉnh tồn",
        href: INVENTORY_ROUTES.adjustments,
        icon: SlidersHorizontal,
        permission: INVENTORY_PERMISSIONS.adjustmentViewPage,
      },
      {
        label: QUARANTINE_LABELS.title,
        href: INVENTORY_ROUTES.quarantine,
        icon: PackageX,
        // Chỉ Quản lý kho cách ly / gỡ cách ly (docs 20 BR-21): StockPackageController UPDATE
        permission: STOCK_PACKAGE_PERMISSIONS.update,
      },
      {
        label: "Lịch sử biến động",
        href: INVENTORY_ROUTES.movements,
        icon: HistoryIcon,
        permission: INVENTORY_PERMISSIONS.movementViewPage,
      },
    ],
  },
  {
    // Giao hàng (docs 09) — lấy hàng, kiểm thùng, cất lại (07, 08) nằm trong tab theo kho
    title: NAV_GROUP_LABELS.shipping,
    icon: Truck,
    items: [
      {
        label: TRIAL_LABELS.pageTitle,
        href: ADMIN_ROUTES.loadEstimateTrial,
        icon: FlaskConical,
        // SCRUM-474 TRIAL-FLOW (LP2-9): chạy thử không lưu, quyền của BE `POST /load-estimates/trial`
        permission: LOAD_ESTIMATE_PERMISSIONS.create,
      },
      {
        label: UI_LABELS.loadPlan.pageTitle,
        href: ADMIN_ROUTES.loadPlans.list,
        icon: CalendarClock,
        // Resource riêng `fulfillment-load-plans` (BE PR #161)
        permission: LOAD_PLAN_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.shipments.title,
        href: ADMIN_ROUTES.shipments.list,
        icon: PackageOpen,
        permission: SHIPMENT_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.loads.title,
        href: ADMIN_ROUTES.loads.list,
        icon: Truck,
        permission: SHIPMENT_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.vehicleType.pageTitle,
        href: ADMIN_ROUTES.vehicleTypes,
        icon: TruckElectric,
        permission: VEHICLE_TYPE_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.waybill.carriers.title,
        href: ADMIN_ROUTES.carriers,
        icon: Handshake,
        // Danh mục hãng: xem là `fulfillment-shipments:READ`, thêm / sửa là `fulfillment-carriers:UPDATE` (resource này không có VIEW_PAGE)
        permission: SHIPMENT_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.carrierEvents.title,
        href: ADMIN_ROUTES.carrierEvents,
        icon: RadioTower,
        // Nhật ký sự kiện webhook và danh sách lỗi: resource `fulfillment-carrier-events` chỉ có READ / UPDATE (không VIEW_PAGE)
        permission: FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read,
      },
    ],
  },
  {
    // Thanh toán theo hợp đồng & công nợ (docs 15), hoá đơn điện tử (docs 21) — việc của Kế toán
    title: PAYMENT_LABELS.navGroup,
    icon: Banknote,
    items: [
      {
        label: PAYMENT_LABELS.installments.navLabel,
        href: PAYMENT_ROUTES.installments.list,
        icon: CalendarClock,
        // BE `payment-installments` (route `/payment/installments`): VIEW_PAGE mở trang
        permission: PAYMENT_INSTALLMENT_PERMISSIONS.viewPage,
      },
      {
        // Công nợ theo khách (BO-UX-37, BE `GET /reports/receivables`, resource `reporting-receivables`); máy chủ chưa
        // có endpoint thì trang tự chuyển sang đợt `owing=true`
        label: RECEIVABLES_LABELS.navLabel,
        href: PAYMENT_ROUTES.receivables,
        icon: Landmark,
        permission: RECEIVABLES_REPORT_PERMISSIONS.viewPage,
      },
      {
        label: PAYMENT_LABELS.receipts.navLabel,
        href: PAYMENT_ROUTES.receipts.list,
        icon: ReceiptText,
        permission: PAYMENT_RECEIPT_PERMISSIONS.viewPage,
      },
      {
        label: PAYMENT_LABELS.refunds.navLabel,
        href: PAYMENT_ROUTES.refunds.list,
        icon: Undo2,
        permission: PAYMENT_REFUND_PERMISSIONS.viewPage,
      },
      // Đơn treo vì tín dụng — Kế toán duyệt / từ chối (docs 15 §4.3 bước 10). Mục riêng, gate bằng quyền
      // credit hold: ACCOUNTANT không có sales-orders:VIEW_PAGE (BE V20261013000400).
      {
        label: UI_LABELS.order.creditHoldsTitle,
        href: ADMIN_ROUTES.orders.creditHolds,
        icon: ShieldAlert,
        permission: CREDIT_HOLD_PERMISSIONS.viewPage,
      },
      {
        // Hoá đơn VAT điện tử theo lần giao (docs 21) — BE `einvoices` (route `/invoicing/einvoices`)
        label: EINVOICE_LABELS.list.navLabel,
        href: EINVOICE_ROUTES.list,
        icon: FileText,
        permission: EINVOICE_PERMISSIONS.viewPage,
      },
      {
        // Bảng kê hoá đơn đã phát hành theo kỳ, xuất CSV cho phần mềm kế toán (docs 21)
        label: "Bảng kê hoá đơn",
        href: EINVOICE_ROUTES.register,
        icon: TableProperties,
        permission: EINVOICE_PERMISSIONS.viewPage,
      },
      {
        // Cấu hình nhà cung cấp hoá đơn điện tử (docs 21 BR-10) — `einvoice-settings` không có VIEW_PAGE
        label: "Cấu hình hoá đơn",
        href: EINVOICE_ROUTES.settings,
        icon: Settings,
        permission: EINVOICE_SETTINGS_PERMISSIONS.read,
      },
    ],
  },
  {
    title: NAV_GROUP_LABELS.system,
    icon: ShieldCheck,
    items: [
      {
        label: "Người dùng",
        href: ADMIN_ROUTES.users.list,
        icon: UserCog,
        // Cổng theo READ (BE `identity-users:READ`), cùng kiểu menu "Phân quyền" ngay dưới
        permission: IDENTITY_PERMISSIONS.usersRead,
      },
      {
        label: "Phân quyền",
        href: ADMIN_ROUTES.permissions,
        icon: ShieldCheck,
        permission: IDENTITY_PERMISSIONS.rbacRead,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Breadcrumb helper                                                        */
/* -------------------------------------------------------------------------- */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Hiện component này thay chữ (vd nút đổi kho kiểu Vercel); `label` vẫn là tên cho test / a11y. */
  render?: ComponentType;
}

/** Đoạn cuối URL là trang con của một bản ghi: `/<module>/<id>/<đoạn>` → "… / <id> / <nhãn>". */
const SUBPAGE_LABELS: Record<string, string> = {
  edit: "Chỉnh sửa",
  manifest: UI_LABELS.shipping.manifest.title,
  /** `/load-plans/<id>/vehicles/<seq>/print` — phiếu xếp hàng của một xe (SCRUM-287 PR F6). */
  print: LOAD_PLAN_PRINT_LABELS.documentTitle,
  /** `/products/<id>/variants/<variantId>/print-config` — cấu hình in của một biến thể (module 12). */
  [PRINT_CONFIG_SEGMENT]: PRINT_CONFIG_PAGE_LABELS.pageTitle,
};

const DETAIL_LABEL_BY_ROUTE: Record<string, string> = {
  "/admin/products/create": "Tạo sản phẩm",
  [ADMIN_ROUTES.customers.create]: "Tạo khách hàng",
  [ADMIN_ROUTES.quotes.create]: "Tạo báo giá",
  [INVENTORY_ROUTES.createAdjustment]: INVENTORY_LABELS.createAdjustment,
  [ADMIN_ROUTES.loadPlans.create]: UI_LABELS.loadPlan.create,
  [ADMIN_ROUTES.loads.waybillImport]: UI_LABELS.shipping.waybill.import.title,
};

/** Required capabilities fail closed; unassigned items remain visible. */
export function useCanSeeNavItem(): (item: NavItem) => boolean {
  const can = usePermissionChecker();
  return (item) =>
    (!item.permission || can(item.permission)) &&
    (!item.anyPermission || item.anyPermission.some(can)) &&
    (!item.unlessPermission || !can(item.unlessPermission));
}

/** Mỗi mục tự gate theo quyền của chính nó; nhóm không còn mục nào thì bỏ (không hiện tiêu đề rỗng). */
export function visibleNavGroups(canSeeItem: (item: NavItem) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSeeItem) })).filter(
    (group) => group.items.length > 0,
  );
}

/** Độ dài tiền tố href (hoặc `matchPrefixes`) khớp `pathname`; 0 = không khớp. */
function matchLength(item: Pick<NavItem, "href" | "matchPrefixes">, pathname: string): number {
  if (item.href === ADMIN_ROUTES.home) return pathname === item.href ? item.href.length : 0;
  return Math.max(
    0,
    ...[item.href, ...(item.matchPrefixes ?? [])]
      .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
      .map((prefix) => prefix.length),
  );
}

/**
 * Mục menu đang mở: khớp dài nhất trong các mục được thấy — `/admin/orders/credit-holds` sáng
 * mục hàng đợi công nợ, không sáng kèm "Đơn hàng" (`/admin/orders`). `/admin` chỉ khớp đúng.
 */
export function findActiveNavHref(
  pathname: string,
  items: readonly Pick<NavItem, "href" | "matchPrefixes">[],
): string | undefined {
  return items
    .map((item) => ({ item, length: matchLength(item, pathname) }))
    .filter((entry) => entry.length > 0)
    .sort((a, b) => b.length - a.length)[0]?.item.href;
}

/**
 * Mục menu của breadcrumb. Route chưa có mục nào thì rơi về mục "Tổng quan" (`/admin`), như trước khi có
 * `matchPrefixes`: breadcrumb vẫn dẫn về trang chủ thay vì chỉ có chữ "Back-office".
 */
function findNavItem(pathname: string): NavItem | undefined {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const best = items
    .map((item) => ({ item, length: matchLength(item, pathname) }))
    .filter((entry) => entry.length > 0)
    .sort((a, b) => b.length - a.length)[0]?.item;
  if (best) return best;
  return pathname.startsWith(`${ADMIN_ROUTES.home}/`)
    ? items.find((item) => item.href === ADMIN_ROUTES.home)
    : undefined;
}

export function buildBreadcrumbItems(
  pathname: string,
  canSeeItem: (item: NavItem) => boolean = () => true,
  /** Nhãn thay cho id trong URL (vd UUID → mã NCC). Không có → hiện id. */
  labelFor: (id: string) => string | undefined = () => undefined,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { label: UI_LABELS.shell.breadcrumbRoot, href: ADMIN_ROUTES.home },
  ];
  if (pathname === ADMIN_ROUTES.home) return items;

  const navItem = findNavItem(pathname);
  if (!navItem) return items;

  // Route anh em (`matchPrefixes`) là trang gốc của chính nó: chỉ hiện tên mục menu.
  const sibling = navItem.matchPrefixes?.some((prefix) => pathname === prefix) ?? false;
  const isListPage = pathname === navItem.href || sibling;
  // Thiếu quyền vào menu này → chỉ hiện chữ, không dẫn tới trang sẽ bị chặn
  const linkable = canSeeItem(navItem);
  items.push({ label: navItem.label, href: isListPage || !linkable ? undefined : navItem.href });

  if (!isListPage && navItem.breadcrumbTail) {
    const rest = pathname
      .slice(navItem.href.length + 1)
      .split("/")
      .filter(Boolean);
    return [...items, ...navItem.breadcrumbTail(rest, labelFor)];
  }
  if (!isListPage) {
    const rest = pathname
      .slice(navItem.href.length + 1)
      .split("/")
      .filter(Boolean);
    // `/<module>/<id>/edit` → "… / <id> / Chỉnh sửa" thay vì chữ "edit"
    const last = rest.at(-1) ?? "";
    // Object.hasOwn: đoạn URL như "constructor" không được trả về hàm của Object.prototype
    const subpage =
      rest.length >= 2 && Object.hasOwn(SUBPAGE_LABELS, last) ? SUBPAGE_LABELS[last] : undefined;
    if (subpage) {
      // Trang nằm sâu hơn một cấp (`<id>/vehicles/<seq>/print`, `<id>/variants/<variantId>/print-config`): bản ghi
      // vẫn là đoạn đầu tiên, nên "… / <mã sản phẩm> / Cấu hình in" dẫn về đúng trang chi tiết sản phẩm.
      const deep = last === "print" || last === PRINT_CONFIG_SEGMENT;
      const id = (deep ? rest.slice(0, 1) : rest.slice(0, -1)).join("/");
      items.push({
        label: labelFor(id) ?? decodeURIComponent(id),
        href: linkable ? `${navItem.href}/${id}` : undefined,
      });
      items.push({ label: subpage });
    } else {
      const last = pathname.split("/").at(-1) ?? "";
      items.push({
        label:
          DETAIL_LABEL_BY_ROUTE[pathname] ??
          labelFor(last) ??
          (last ? decodeURIComponent(last) : "Chi tiết"),
      });
    }
  }

  return items;
}

/* -------------------------------------------------------------------------- */
/*  Sidebar nội dung — dùng shadcn primitives, giữ nguyên style StockFlow     */
/* -------------------------------------------------------------------------- */

/**
 * Nút thu gọn / mở rộng sidebar ở đầu topbar (mẫu layout của shadcn): cùng một chỗ dù sidebar
 * đang mở hay thu gọn, và cũng là nút mở sidebar trên mobile. Phím tắt Ctrl/⌘+B do
 * `SidebarProvider` lo sẵn.
 */
function SidebarCollapseButton() {
  const { state, isMobile, openMobile, toggleSidebar } = useSidebar();
  const open = isMobile ? openMobile : state === "expanded";
  const label = open ? "Thu nhỏ sidebar" : "Mở rộng sidebar";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-7 shrink-0 rounded-[var(--r-sm)] bg-transparent"
          aria-label={label}
        >
          {open ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label} (Ctrl+B)</TooltipContent>
    </Tooltip>
  );
}

/** Sidebar thu gọn: icon kính lúp — bấm thì mở rộng sidebar và đưa con trỏ vào ô search. */
function SidebarSearchIcon() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            toggleSidebar();
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLInputElement>(
                  `input[aria-label="${UI_LABELS.shell.globalSearch}"]`,
                )
                ?.focus(),
            );
          }}
          className="text-ink-secondary hover:bg-bg-muted hover:text-ink-primary size-8 rounded-[var(--r-sm)] bg-transparent"
          aria-label={UI_LABELS.shell.quickSearch}
        >
          <SearchIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{UI_LABELS.shell.quickSearchHint}</TooltipContent>
    </Tooltip>
  );
}

function BackofficeSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const chatBadge = useStaffChatBadge();
  // Chỉ chat có số đếm thật của BE (S22) — không bịa số "cần chú ý" cho module khác.
  const warningCounts = useMemo<Record<string, number>>(
    (): Record<string, number> => (chatBadge > 0 ? { [ADMIN_ROUTES.chat.list]: chatBadge } : {}),
    [chatBadge],
  );
  const canSeeItem = useCanSeeNavItem();
  const visibleGroups = visibleNavGroups(canSeeItem);
  const activeHref = findActiveNavHref(
    pathname,
    visibleGroups.flatMap((group) => group.items),
  );

  return (
    <Sidebar
      collapsible="icon"
      className="border-border-default [&_[data-slot=sidebar-inner]]:bg-sidebar border-r"
    >
      <SidebarHeader
        className={cn("shrink-0 gap-2", collapsed ? "items-center px-0 py-2" : "px-2 py-2")}
      >
        {/* Logo + tên app ở đầu sidebar; thu gọn chỉ còn logo (alt = tên thương hiệu) */}
        <div
          className={cn(
            "text-ink-primary flex h-9 items-center gap-2 text-base font-bold tracking-tight",
            collapsed ? "justify-center" : "px-1",
          )}
        >
          <Logo variant="mark" height={28} decorative={!collapsed} />
          {/* "Commerce" nhạt hơn để tên dài không lấn logo — chữ lấy từ BRAND.wordmark */}
          {!collapsed && (
            <span className="truncate">
              {BRAND.wordmark.primary}
              {BRAND.wordmark.accent}
              <span className="text-ink-secondary font-medium">{BRAND.wordmark.suffix}</span>
            </span>
          )}
        </div>
        {collapsed ? (
          <SidebarSearchIcon />
        ) : (
          // Ô search toàn cục dưới tên app, dùng hết chiều rộng sidebar
          <SearchBar
            placeholder={UI_LABELS.shell.quickSearchHint}
            className="min-w-0"
            aria-label={UI_LABELS.shell.globalSearch}
          />
        )}
      </SidebarHeader>

      {/* Nav: item cha mở/đóng kiểu Vercel. Scrollbar mảnh, không có nút mũi tên — chỉ dùng
          ::-webkit-scrollbar (đặt `scrollbar-width` thì Chrome bỏ qua style webkit và hiện mũi tên) */}
      <SidebarContent className="[&::-webkit-scrollbar-thumb]:bg-border-strong min-h-0 flex-1 gap-0 overflow-y-auto px-2 py-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        <SidebarNav
          groups={NAV_GROUPS}
          activeHref={activeHref}
          canSeeItem={canSeeItem}
          warningCounts={warningCounts}
          collapsed={collapsed}
        />
      </SidebarContent>

      <SidebarFooterBar />
      {/* Vạch mảnh ở mép phải: rê chuột hiện, bấm để thu gọn / mở rộng */}
      <SidebarRail />
    </Sidebar>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shell                                                                    */
/* -------------------------------------------------------------------------- */

export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const canSeeItem = useCanSeeNavItem();
  const breadcrumbLabels = useBreadcrumbLabelStore((s) => s.labels);
  // Chế độ mở rộng (vd bảng dòng PO) ép sidebar thu gọn; tắt thì về lại trạng thái người dùng chọn.
  // Sidebar điều khiển từ đây: đang mở rộng mà bấm thu/mở (nút, Ctrl/⌘+B) = thoát chế độ mở rộng
  // rồi áp lựa chọn đó — không để nút "chết" và không ngầm đổi trạng thái của người dùng.
  const focusMode = useAppStore((s) => s.focusMode);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const onSidebarOpenChange = (open: boolean) => {
    if (focusMode) setFocusMode(false);
    setSidebarOpen(open);
  };
  const breadcrumbItems = buildBreadcrumbItems(pathname, canSeeItem, (id) => breadcrumbLabels[id]);

  return (
    <TooltipProvider>
      <SidebarProvider
        open={focusMode ? false : sidebarOpen}
        onOpenChange={onSidebarOpenChange}
        // h-svh + overflow-hidden ghi đè `min-h-svh` của SidebarProvider: chiều cao phải
        // BỊ CHẶN để `overflow-auto` của <main> có hiệu lực, nhờ đó topbar/sidebar đứng yên
        // và chỉ vùng nội dung cuộn. Dùng min-h-* thì cả trang cuộn, topbar trôi theo.
        // In (biên bản bàn giao): bỏ khung cố định chiều cao để in đủ nội dung, ẩn sidebar + topbar
        className="bg-bg-surface h-svh overflow-hidden print:h-auto print:overflow-visible print:[&_[data-slot=sidebar]]:hidden"
        style={
          {
            "--sidebar-width": "240px",
            "--sidebar-width-icon": "60px",
          } as React.CSSProperties
        }
      >
        <BackofficeSidebar />

        {/* ================================================================== */}
        {/*  Main area                                                        */}
        {/* ================================================================== */}
        <SidebarInset className="bg-bg-base flex min-h-0 min-w-0 flex-col">
          {/* Topbar */}
          <header className="border-border-default bg-bg-base relative flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
            <SidebarCollapseButton />
            <div aria-hidden className="bg-border-default mr-1 h-4 w-px shrink-0" />

            {/* Breadcrumb căn giữa topbar (absolute để giữa thật, không lệch theo nút bên trái) */}
            <div className="absolute inset-x-0 mx-auto flex w-fit max-w-[60%] min-w-0 justify-center">
              <nav
                aria-label="Breadcrumb"
                className="text-ink-tertiary flex min-w-0 items-center gap-1.5 text-sm"
              >
                {breadcrumbItems.map((item, index) => (
                  <span
                    key={`${item.label}-${index}`}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    {index > 0 && <span className="opacity-50">/</span>}
                    {item.render ? (
                      <item.render />
                    ) : item.href ? (
                      <Link
                        href={item.href}
                        className="text-ink-secondary hover:text-ink-primary truncate transition-colors"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-ink-primary truncate font-medium">{item.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            <NotificationBell itemAction={notificationItemAction} />
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 print:overflow-visible print:p-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
