"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import {
  prefixFromPath,
  samePrefix,
  useWorkspaceWarehouses,
} from "@/features/warehouse-map/workspace";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const W = UI_LABELS.warehouseMap.workspace;
const ROOT = ADMIN_ROUTES.warehouseMap.root;

/** Đổi prefix trong đường dẫn hiện tại — đổi kho mà vẫn ở đúng trang (bản đồ / gợi ý vị trí). */
const swapPrefix = (pathname: string, from: string, to: string) =>
  `${ROOT}/${encodeURIComponent(to)}${pathname.slice(`${ROOT}/${encodeURIComponent(from)}`.length)}`;

/**
 * Đoạn breadcrumb "kho đang làm việc" kiểu Vercel: `BD · Kho Bình Dương ⇅` — bấm xổ danh sách kho để
 * chuyển sang kho khác ngay tại trang hiện tại.
 */
export function WarehouseCrumb() {
  const pathname = usePathname();
  const prefix = prefixFromPath(pathname, ROOT) ?? "";
  const { warehouses } = useWorkspaceWarehouses();
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
                  href={swapPrefix(pathname, prefix, warehouse.prefix)}
                  aria-current={active ? "page" : undefined}
                  className="hover:bg-bg-muted aria-[current=page]:bg-bg-muted text-ink-primary flex items-center gap-2 rounded-(--r-sm) px-2 py-1.5 text-sm"
                >
                  <span className="w-12 shrink-0 font-[family-name:var(--font-mono)] text-xs font-semibold">
                    {warehouse.prefix}
                  </span>
                  <span className="truncate">{warehouse.name}</span>
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
 * Phần breadcrumb sau "Kho & bản đồ" cho trang của một kho: `[kho ⇅] / <trang>`. Shell gọi qua
 * `NavItem.breadcrumbTail` với các đoạn URL sau `/admin/warehouse-map`.
 */
export function warehouseBreadcrumbTail(rest: readonly string[]) {
  const [prefix = "", page] = rest;
  return [
    { label: decodeURIComponent(prefix), render: WarehouseCrumb },
    { label: page === "slotting" ? W.pages.slotting : W.pages.map },
  ];
}
