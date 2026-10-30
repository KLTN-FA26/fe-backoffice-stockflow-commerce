"use client";

import { cn } from "cn";
import {
  ArrowRightLeft,
  BellRing,
  Boxes,
  CalendarClock,
  ClipboardList,
  Database,
  FileBox,
  FileText,
  FolderTree,
  History as HistoryIcon,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MapPin,
  Move,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search as SearchIcon,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Tags,
  Truck,
  TruckElectric,
  Undo2,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ADMIN_ROUTES,
  ATTRIBUTE_PERMISSIONS,
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_PICKING_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_PRINT_LABELS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  PUT_BACK_LABELS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  UI_LABELS,
  VEHICLE_TYPE_PERMISSIONS,
} from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";

import { NotificationBell } from "@/features/notification";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useAppStore } from "@/lib/store/use-app-store";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";
import { invoices, purchaseOrders, putawayTasks } from "@/lib/mock-data";
import { useIsMock } from "@/providers/app-providers";

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
import type { PermissionCode } from "@/lib/auth/me-permissions";
/* -------------------------------------------------------------------------- */
/*  Warning dot counts — computed from mock data (mock mode only: the BE has */
/*  no cross-module "needs attention" counts, so real mode shows no badge)    */
/* -------------------------------------------------------------------------- */

const WARNING_STATUSES: Record<string, string[]> = {
  "/admin/purchase-orders": ["Pending Approval"],
  "/admin/invoices": ["Exception", "Disputed"],
  "/admin/putaway": ["On Hold"],
};

function computeWarningCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  counts["/admin/purchase-orders"] = purchaseOrders.filter((po) =>
    WARNING_STATUSES["/admin/purchase-orders"]!.includes(po.status),
  ).length;
  counts["/admin/invoices"] = invoices.filter((inv) =>
    WARNING_STATUSES["/admin/invoices"]!.includes(inv.status),
  ).length;
  counts["/admin/putaway"] = putawayTasks.filter((pt) =>
    WARNING_STATUSES["/admin/putaway"]!.includes(pt.status),
  ).length;
  return counts;
}

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
  /** Màn chỉ chạy được trên mock (BE chưa có API) — ẩn khi nối BE thật. */
  mockOnly?: boolean;
}

export interface NavGroup {
  /** Tên item cha trong sidebar. */
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    icon: LayoutDashboard,
    items: [{ label: "Tổng quan", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Master data",
    icon: Database,
    items: [
      {
        label: "Sản phẩm & SKU",
        href: "/admin/products",
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
        label: "Nhà cung cấp",
        href: "/admin/suppliers",
        icon: Users,
        permission: SUPPLIER_PERMISSIONS.viewPage,
      },
      {
        label: CUSTOMER_PRICE_UI_LABELS.navLabel,
        href: ADMIN_ROUTES.customerPrices.list,
        icon: Tags,
        // BE `@PermissionResource(catalog-customer-prices)`: VIEW_PAGE mở trang (seed: ECOMMERCE_ADMIN, SALES_STAFF)
        permission: CUSTOMER_PRICE_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    title: "Platform",
    icon: ShieldCheck,
    items: [
      {
        label: "Phân quyền",
        href: ADMIN_ROUTES.permissions,
        icon: ShieldCheck,
        permission: IDENTITY_PERMISSIONS.rbacRead,
      },
      {
        label: "Người dùng",
        href: ADMIN_ROUTES.users.list,
        icon: UserCog,
        // Cổng theo READ (BE `identity-users:READ`), cùng kiểu menu "Phân quyền" ngay trên
        permission: IDENTITY_PERMISSIONS.usersRead,
      },
    ],
  },
  {
    title: "Mua hàng",
    icon: ShoppingBag,
    items: [
      {
        label: "Đề xuất nhập hàng",
        href: "/admin/replenishment",
        icon: Lightbulb,
        // BE chưa có API đề xuất nhập hàng (chỉ có đánh giá ngưỡng tồn) — màn chạy trên dữ liệu mẫu
        mockOnly: true,
      },
      {
        label: "Đơn đặt NCC",
        href: "/admin/purchase-orders",
        icon: ShoppingCart,
        permission: PO_PERMISSIONS.viewPage,
      },
      {
        label: "Hoá đơn NCC",
        href: "/admin/invoices",
        icon: Receipt,
        // BE chưa có API hoá đơn NCC (`/invoices`) — màn chạy trên dữ liệu mẫu
        mockOnly: true,
      },
    ],
  },
  {
    title: "Nhập hàng",
    icon: PackagePlus,
    items: [
      {
        label: "Phiếu nhận",
        href: ADMIN_ROUTES.receipts.list,
        icon: FileText,
        permission: GOODS_RECEIPT_PERMISSIONS.viewPage,
      },
      { label: "Cất hàng", href: "/admin/putaway", icon: PackageCheck },
    ],
  },
  {
    title: "Kho",
    icon: WarehouseIcon,
    items: [
      {
        label: INVENTORY_LABELS.overviewTitle,
        href: INVENTORY_ROUTES.overview,
        icon: Boxes,
        // Same rule as the page gate: stock READ or reservation READ; alert READ alone is not enough.
        anyPermission: [
          INVENTORY_OVERVIEW_PERMISSIONS.stockRead,
          INVENTORY_OVERVIEW_PERMISSIONS.reservationRead,
        ],
      },
      {
        label: INVENTORY_LABELS.alertListTitle,
        href: INVENTORY_ROUTES.alerts,
        icon: BellRing,
        // BE StockAlertController khai báo VIEW_PAGE cho inventory-alerts (route của deep link thông báo)
        permission: INVENTORY_OVERVIEW_PERMISSIONS.alertViewPage,
      },
      {
        label: "Hồ sơ hàng tồn",
        href: ADMIN_ROUTES.inventoryItems.list,
        // Hồ sơ cấu hình SKU — khác icon Boxes của "Tổng quan tồn kho" (số lượng tồn)
        icon: FileBox,
        // Route BE khai báo cho resource inventory-inventory-items (PR #119)
        permission: INVENTORY_ITEM_PERMISSIONS.viewPage,
      },
      {
        label: "Kho map & slotting",
        href: "/admin/warehouse-map",
        icon: MapPin,
      },
      {
        label: "Gợi ý vị trí",
        href: "/admin/slotting",
        icon: Lightbulb,
      },
      {
        label: UI_LABELS.transfer.pageTitle,
        href: ADMIN_ROUTES.transfers.list,
        icon: ArrowRightLeft,
        permission: TRANSFER_PERMISSIONS.viewPage,
      },
      {
        label: "Di chuyển nội bộ",
        href: "/admin/moves",
        icon: Move,
        // BE StockOperationsController: POST /inventory/movements là inventory-stock-items:UPDATE
        permission: INVENTORY_PERMISSIONS.stockUpdate,
      },
      {
        label: "Điều chỉnh tồn",
        href: INVENTORY_ROUTES.adjustments,
        icon: SlidersHorizontal,
        permission: INVENTORY_PERMISSIONS.adjustmentViewPage,
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
    title: "Thực hiện đơn",
    icon: ListChecks,
    items: [
      {
        label: "Đơn hàng",
        href: ADMIN_ROUTES.orders.list,
        icon: ClipboardList,
        permission: ORDER_PERMISSIONS.viewPage,
      },
      // Mục riêng, gate bằng quyền credit hold — ACCOUNTANT duyệt công nợ nhưng không có
      // sales-orders:VIEW_PAGE nên không đi qua được mục "Đơn hàng" (BE V20261013000400).
      {
        label: UI_LABELS.order.creditHoldsTitle,
        href: ADMIN_ROUTES.orders.creditHolds,
        icon: ShieldAlert,
        permission: CREDIT_HOLD_PERMISSIONS.viewPage,
      },
      {
        label: "Lấy hàng",
        href: ADMIN_ROUTES.picking.list,
        icon: WarehouseIcon,
        permission: FULFILLMENT_PICK_PERMISSIONS.viewPage,
      },
      {
        label: "Đóng gói",
        href: ADMIN_ROUTES.packing.list,
        icon: PackageCheck,
        permission: FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
      },
      {
        label: PUT_BACK_LABELS.title,
        href: ADMIN_ROUTES.putBacks.list,
        icon: Undo2,
        // BE `GET /fulfillment/put-backs` — fulfillment-picking:READ (resource không có VIEW_PAGE)
        permission: FULFILLMENT_PICKING_PERMISSIONS.read,
      },
      {
        label: UI_LABELS.loadPlan.pageTitle,
        href: ADMIN_ROUTES.loadPlans.list,
        icon: CalendarClock,
        // Resource riêng `fulfillment-load-plans` (BE PR #161)
        permission: LOAD_PLAN_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.vehicleType.pageTitle,
        href: ADMIN_ROUTES.vehicleTypes,
        icon: TruckElectric,
        permission: VEHICLE_TYPE_PERMISSIONS.viewPage,
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
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Breadcrumb helper                                                        */
/* -------------------------------------------------------------------------- */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Đoạn cuối URL là trang con của một bản ghi: `/<module>/<id>/<đoạn>` → "… / <id> / <nhãn>". */
const SUBPAGE_LABELS: Record<string, string> = {
  edit: "Chỉnh sửa",
  manifest: UI_LABELS.shipping.manifest.title,
  /** `/load-plans/<id>/vehicles/<seq>/print` — phiếu xếp hàng của một xe (SCRUM-287 PR F6). */
  print: LOAD_PLAN_PRINT_LABELS.documentTitle,
};

const DETAIL_LABEL_BY_ROUTE: Record<string, string> = {
  "/admin/products/create": "Tạo sản phẩm",
  "/admin/purchase-orders/create": "Tạo đơn đặt hàng",
  "/admin/suppliers/create": "Tạo nhà cung cấp",
  [INVENTORY_ROUTES.createAdjustment]: INVENTORY_LABELS.createAdjustment,
  "/admin/transfers/create": "Tạo lệnh chuyển kho",
  [ADMIN_ROUTES.loadPlans.create]: UI_LABELS.loadPlan.create,
};

/** Required capabilities fail closed; unassigned items remain visible; mock-only items need mock mode. */
export function useCanSeeNavItem(): (item: NavItem) => boolean {
  const can = usePermissionChecker();
  const isMock = useIsMock();
  return (item) =>
    (!item.mockOnly || isMock) &&
    (!item.permission || can(item.permission)) &&
    (!item.anyPermission || item.anyPermission.some(can));
}

/** Mỗi mục tự gate theo quyền của chính nó; nhóm không còn mục nào thì bỏ (không hiện tiêu đề rỗng). */
export function visibleNavGroups(canSeeItem: (item: NavItem) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSeeItem) })).filter(
    (group) => group.items.length > 0,
  );
}

/**
 * Mục menu đang mở: khớp dài nhất trong các mục được thấy — `/admin/orders/credit-holds` sáng
 * mục hàng đợi công nợ, không sáng kèm "Đơn hàng" (`/admin/orders`). `/admin` chỉ khớp đúng.
 */
export function findActiveNavHref(
  pathname: string,
  items: readonly Pick<NavItem, "href">[],
): string | undefined {
  return items
    .filter((item) =>
      item.href === ADMIN_ROUTES.home
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function findNavItem(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function buildBreadcrumbItems(
  pathname: string,
  canSeeItem: (item: NavItem) => boolean = () => true,
  /** Nhãn thay cho id trong URL (vd UUID → mã NCC). Không có → hiện id. */
  labelFor: (id: string) => string | undefined = () => undefined,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: "Back-office", href: ADMIN_ROUTES.home }];
  if (pathname === ADMIN_ROUTES.home) return items;

  const navItem = findNavItem(pathname);
  if (!navItem) return items;

  const isListPage = pathname === navItem.href;
  // Thiếu quyền vào menu này → chỉ hiện chữ, không dẫn tới trang sẽ bị chặn
  const linkable = canSeeItem(navItem);
  items.push({ label: navItem.label, href: isListPage || !linkable ? undefined : navItem.href });

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
      // Trang in nằm sâu hơn một cấp (`<id>/vehicles/<seq>/print`): bản ghi vẫn là đoạn đầu tiên
      const id = (last === "print" ? rest.slice(0, 1) : rest.slice(0, -1)).join("/");
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

  const isMock = useIsMock();
  // Số đếm lấy từ dữ liệu mẫu: không hiện khi nối BE thật (không bịa số liệu)
  const warningCounts = useMemo<Record<string, number>>(
    () => (isMock ? computeWarningCounts() : {}),
    [isMock],
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
        {/* Tên app ở đầu sidebar; thu gọn chỉ còn chữ cái đầu */}
        <div
          className={cn(
            "text-ink-primary flex h-9 items-center text-lg font-bold tracking-tight",
            collapsed ? "justify-center" : "px-2",
          )}
        >
          {collapsed ? UI_LABELS.shell.appName.charAt(0) : UI_LABELS.shell.appName}
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
                    {item.href ? (
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
            <NotificationBell />
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
