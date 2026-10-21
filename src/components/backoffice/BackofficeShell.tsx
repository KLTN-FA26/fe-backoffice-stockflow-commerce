"use client";

import { cn } from "cn";
import {
  ArrowRightLeft,
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
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import {
  ADMIN_ROUTES,
  ATTRIBUTE_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  GOODS_RECEIPT_PERMISSIONS,
  IDENTITY_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  INVENTORY_OVERVIEW_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  ORDER_PERMISSIONS,
  PO_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SUPPLIER_PERMISSIONS,
  TRANSFER_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";

import { usePermissionChecker } from "@/lib/auth/components/Can";
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
  tooltip: string;
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
    items: [{ label: "Tổng quan", tooltip: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Master data",
    icon: Database,
    items: [
      {
        label: "Sản phẩm & SKU",
        tooltip: "Products & SKUs",
        href: "/admin/products",
        icon: Package,
      },
      {
        label: "Từ điển thuộc tính",
        tooltip: "Attribute dictionary",
        href: ADMIN_ROUTES.attributes,
        icon: Palette,
        permission: ATTRIBUTE_PERMISSIONS.viewPage,
      },
      {
        label: "Thương hiệu & danh mục",
        tooltip: "Brands & Categories",
        href: ADMIN_ROUTES.taxonomy.list,
        icon: FolderTree,
        // BE gate mọi endpoint /brands, /categories bằng product-products (ProductTaxonomyController)
        permission: PRODUCT_PERMISSIONS.viewPage,
      },
      {
        label: "Nhà cung cấp",
        tooltip: "Suppliers",
        href: "/admin/suppliers",
        icon: Users,
        permission: SUPPLIER_PERMISSIONS.viewPage,
      },
    ],
  },
  {
    title: "Platform",
    icon: ShieldCheck,
    items: [
      {
        label: "Phân quyền",
        tooltip: "Permission management",
        href: ADMIN_ROUTES.permissions,
        icon: ShieldCheck,
        permission: IDENTITY_PERMISSIONS.rbacRead,
      },
    ],
  },
  {
    title: "Mua hàng",
    icon: ShoppingBag,
    items: [
      {
        label: "Đề xuất nhập hàng",
        tooltip: "Replenishment",
        href: "/admin/replenishment",
        icon: Lightbulb,
        // BE chưa có API đề xuất nhập hàng (chỉ có đánh giá ngưỡng tồn) — màn chạy trên dữ liệu mẫu
        mockOnly: true,
      },
      {
        label: "Đơn đặt NCC",
        tooltip: "Purchase Orders",
        href: "/admin/purchase-orders",
        icon: ShoppingCart,
        permission: PO_PERMISSIONS.viewPage,
      },
      {
        label: "Hoá đơn NCC",
        tooltip: "Supplier Invoices",
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
        tooltip: "Goods receipts",
        href: ADMIN_ROUTES.receipts.list,
        icon: FileText,
        permission: GOODS_RECEIPT_PERMISSIONS.viewPage,
      },
      { label: "Cất hàng", tooltip: "Putaway", href: "/admin/putaway", icon: PackageCheck },
    ],
  },
  {
    title: "Kho",
    icon: WarehouseIcon,
    items: [
      {
        label: INVENTORY_LABELS.overviewTitle,
        tooltip: "Inventory Overview",
        href: INVENTORY_ROUTES.overview,
        icon: Boxes,
        // Same rule as the page gate: stock READ or reservation READ; alert READ alone is not enough.
        anyPermission: [
          INVENTORY_OVERVIEW_PERMISSIONS.stockRead,
          INVENTORY_OVERVIEW_PERMISSIONS.reservationRead,
        ],
      },
      {
        label: "Hồ sơ hàng tồn",
        tooltip: "Inventory items",
        href: ADMIN_ROUTES.inventoryItems.list,
        // Hồ sơ cấu hình SKU — khác icon Boxes của "Tổng quan tồn kho" (số lượng tồn)
        icon: FileBox,
        // Route BE khai báo cho resource inventory-inventory-items (PR #119)
        permission: INVENTORY_ITEM_PERMISSIONS.viewPage,
      },
      {
        label: "Kho map & slotting",
        tooltip: "Warehouse Map",
        href: "/admin/warehouse-map",
        icon: MapPin,
      },
      {
        label: "Gợi ý vị trí",
        tooltip: "Slotting Suggestions",
        href: "/admin/slotting",
        icon: Lightbulb,
      },
      {
        label: UI_LABELS.transfer.pageTitle,
        tooltip: "Inter-warehouse Transfers",
        href: ADMIN_ROUTES.transfers.list,
        icon: ArrowRightLeft,
        permission: TRANSFER_PERMISSIONS.viewPage,
      },
      {
        label: "Di chuyển nội bộ",
        tooltip: "Intra-warehouse Moves",
        href: "/admin/moves",
        icon: Move,
        // BE StockOperationsController: POST /inventory/movements là inventory-stock-items:UPDATE
        permission: INVENTORY_PERMISSIONS.stockUpdate,
      },
      {
        label: "Điều chỉnh tồn",
        tooltip: "Stock adjustments",
        href: INVENTORY_ROUTES.adjustments,
        icon: SlidersHorizontal,
        permission: INVENTORY_PERMISSIONS.adjustmentRead,
      },
      {
        label: "Lịch sử biến động",
        tooltip: "Stock movement history",
        href: INVENTORY_ROUTES.movements,
        icon: HistoryIcon,
        permission: INVENTORY_PERMISSIONS.movementRead,
      },
    ],
  },
  {
    title: "Thực hiện đơn",
    icon: ListChecks,
    items: [
      {
        label: "Đơn hàng",
        tooltip: "Orders",
        href: ADMIN_ROUTES.orders.list,
        icon: ClipboardList,
        permission: ORDER_PERMISSIONS.viewPage,
      },
      {
        label: "Lấy hàng",
        tooltip: "Picking",
        href: ADMIN_ROUTES.picking.list,
        icon: WarehouseIcon,
        permission: FULFILLMENT_PICK_PERMISSIONS.viewPage,
      },
      {
        label: "Đóng gói",
        tooltip: "Packing",
        href: ADMIN_ROUTES.packing.list,
        icon: PackageCheck,
        permission: FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.loadPlanTitle,
        tooltip: "Load planning",
        href: ADMIN_ROUTES.loadPlans,
        icon: CalendarClock,
        // Chưa có resource quyền riêng (SCRUM-452) — tạm theo quyền xem màn xếp xe
        permission: SHIPMENT_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.shipments.title,
        tooltip: "Shipments waiting for dispatch",
        href: ADMIN_ROUTES.shipments.list,
        icon: PackageOpen,
        permission: SHIPMENT_PERMISSIONS.viewPage,
      },
      {
        label: UI_LABELS.shipping.loads.title,
        tooltip: "Loading & carrier handover",
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
};

const DETAIL_LABEL_BY_ROUTE: Record<string, string> = {
  "/admin/products/create": "Tạo sản phẩm",
  "/admin/purchase-orders/create": "Tạo đơn đặt hàng",
  "/admin/suppliers/create": "Tạo nhà cung cấp",
  [INVENTORY_ROUTES.createAdjustment]: INVENTORY_LABELS.createAdjustment,
  "/admin/transfers/create": "Tạo lệnh chuyển kho",
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
      const id = rest.slice(0, -1).join("/");
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
          activeHref={findNavItem(pathname)?.href}
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
  const breadcrumbItems = buildBreadcrumbItems(pathname, canSeeItem, (id) => breadcrumbLabels[id]);

  return (
    <TooltipProvider>
      <SidebarProvider
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
