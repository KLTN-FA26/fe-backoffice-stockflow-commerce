"use client";

import Link from "next/link";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { ITEM_ACTIVE, ITEM_IDLE, NAV_ROW } from "@/components/backoffice/SidebarNavCollapsed";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

import { usePanelWarehouse } from "./use-panel-warehouse";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const W = UI_LABELS.warehouseMap.workspace;

/** Một dòng link của panel tab "Kho" — cùng cỡ với dòng menu sidebar (`NAV_ROW`). */
export function NavRow({
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

/** Tiêu đề nhóm nhỏ; `divided` thêm vạch ngăn phía trên (nhóm không thuộc kho đang làm việc). */
export function NavGroupTitle({ children, divided }: { children: ReactNode; divided?: boolean }) {
  return (
    // `cn` chỉ nối class (không merge) — pt-2 / pt-3 tách nhánh, không cùng lúc
    <SidebarMenuItem
      className={cn("px-3 pb-0.5", divided ? "border-border-default mt-2 border-t pt-3" : "pt-2")}
    >
      <p className="text-ink-tertiary text-[0.6875rem] font-medium">{children}</p>
    </SidebarMenuItem>
  );
}

/**
 * Dòng tiêu đề (nút quay lại) của panel tab "Kho" — `NavGroup.panelTitle`. Đã có kho (URL hoặc kho mở gần nhất) → tên kho +
 * prefix thay chữ "Kho": các link Vận hành / Bản đồ bên dưới đều trỏ vào kho này, kể cả ở Danh mục kho / Sức chứa kho.
 */
export function WarehouseNavTitle() {
  const { prefix, name } = usePanelWarehouse();
  if (!prefix) return <span className="truncate">{W.navGroup}</span>;
  return (
    <span title={`${W.current}: ${prefix}`} className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate">{name ?? prefix}</span>
      <span className="text-ink-tertiary ml-auto shrink-0 font-[family-name:var(--font-mono)] text-xs font-normal">
        {prefix}
      </span>
    </span>
  );
}

/** Chưa vào kho nào: gợi ý vào kho từ Danh mục kho (khung viền đứt, không phải nút). */
export function PickWarehouseHint() {
  return (
    <SidebarMenuItem className="mb-1 px-1">
      <p className="border-border-default text-ink-secondary rounded-[var(--r-md)] border border-dashed px-2.5 py-2 text-xs leading-snug">
        {W.pickHint}
      </p>
    </SidebarMenuItem>
  );
}
