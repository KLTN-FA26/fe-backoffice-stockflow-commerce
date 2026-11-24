"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { canEnterWarehouse, useAssignedWarehouses } from "@/lib/auth";

import {
  prefixFromPath,
  samePrefix,
  switchWarehouseHref,
  useWorkspaceWarehouses,
} from "@/features/warehouse-map/workspace";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { matchWorkspacePage, WORKSPACE_PAGES } from "./workspace-pages";

const W = UI_LABELS.warehouseMap.workspace;
const ROOT = ADMIN_ROUTES.warehouseMap.root;

/**
 * Đoạn breadcrumb "kho đang làm việc" kiểu Vercel: `BD · Kho Bình Dương ⇅` — bấm xổ danh sách kho để
 * chuyển sang kho khác ngay tại trang hiện tại.
 */
export function WarehouseCrumb() {
  const pathname = usePathname();
  const prefix = prefixFromPath(pathname, ROOT) ?? "";
  const { warehouses } = useWorkspaceWarehouses();
  const assigned = useAssignedWarehouses();
  const current = warehouses?.find((w) => samePrefix(w.prefix, prefix));
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${W.change}: ${prefix}`}
        className="text-ink-primary hover:bg-bg-muted focus-visible:ring-border-strong flex min-w-0 items-center gap-1 rounded-(--r-sm) px-1.5 py-0.5 font-medium outline-none focus-visible:ring-2"
      >
        <span className="font-[family-name:var(--font-mono)]">{prefix.toUpperCase()}</span>
        {current && <span className="truncate">· {current.name}</span>}
        <ChevronsUpDown className="text-ink-tertiary size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-1">
        <p className="text-ink-tertiary px-2 py-1 text-[0.6875rem]">{W.change}</p>
        <ul className="max-h-72 overflow-y-auto">
          {(warehouses ?? []).map((warehouse) => {
            const active = samePrefix(warehouse.prefix, prefix);
            return (
              <li key={warehouse.id}>
                <Link
                  href={switchWarehouseHref(pathname, warehouse.prefix, WORKSPACE_PAGES)}
                  aria-current={active ? "page" : undefined}
                  className="hover:bg-bg-muted aria-[current=page]:bg-bg-muted text-ink-primary flex items-center gap-2 rounded-(--r-sm) px-2 py-1.5 text-sm"
                >
                  <span className="w-12 shrink-0 font-[family-name:var(--font-mono)] text-xs font-semibold">
                    {warehouse.prefix}
                  </span>
                  <span className="truncate">{warehouse.name}</span>
                  {/* Vẫn mở được (bản đồ không giới hạn theo kho được gán — 06); màn vận hành sẽ báo */}
                  {!canEnterWarehouse(assigned, warehouse.prefix) && (
                    <Badge variant="outline" className="ml-auto shrink-0">
                      {W.notAssignedBadge}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href={ADMIN_ROUTES.warehouses.list}
          className="text-ink-secondary hover:bg-bg-muted border-border-default mt-1 block rounded-(--r-sm) border-t px-2 py-1.5 text-xs"
        >
          {W.backToChooser}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Phần breadcrumb sau "Kho" cho trang của một kho: `[kho ⇅] / <trang> / <id>`. Shell gọi qua
 * `NavItem.breadcrumbTail` với các đoạn URL sau `/admin/warehouse-map`. Trang tra theo `WORKSPACE_PAGES`; còn đoạn sau
 * (trang chi tiết) thì tên trang là link về trang list.
 */
export function warehouseBreadcrumbTail(
  rest: readonly string[],
  /** Nhãn thay id trong URL (vd id nhiệm vụ → LPN, trang chi tiết đăng ký qua `useBreadcrumbLabel`). */
  labelFor: (id: string) => string | undefined = () => undefined,
) {
  const [prefix = "", ...after] = rest;
  const page = matchWorkspacePage(after);
  const crumbs: { label: string; href?: string; render?: typeof WarehouseCrumb }[] = [
    { label: decodeURIComponent(prefix), render: WarehouseCrumb },
  ];
  if (!page) return [...crumbs, { label: W.pages.map }];
  const tail = after.slice(page.path.split("/").length);
  crumbs.push({
    label: page.label,
    href:
      tail.length > 0
        ? ADMIN_ROUTES.warehouseMap.page(decodeURIComponent(prefix), page.path)
        : undefined,
  });
  if (tail.length > 0) {
    // Id bản ghi là đoạn cuối (`putaway/trips/{id}` → id chuyến)
    const id = tail.at(-1) ?? "";
    crumbs.push({ label: labelFor(id) ?? decodeURIComponent(id) });
  }
  return crumbs;
}
