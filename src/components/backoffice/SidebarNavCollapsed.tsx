"use client";

import { cn } from "cn";
import Link from "next/link";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

import type { NavGroup, NavItem } from "./BackofficeShell";

/** Class item menu: thường / đang mở (nền muted nhẹ như Vercel). Dùng chung cho SidebarNav. */
/** Một dòng menu sidebar (cao 36px, chữ 14px, icon 14px) — dùng chung cho menu và panel riêng của nhóm. */
export const NAV_ROW =
  "h-9 gap-2.5 rounded-[var(--r-md)] px-3 text-sm transition-colors duration-150 [&>svg]:size-3.5";
export const ITEM_IDLE = "text-ink-primary hover:bg-bg-muted";
export const ITEM_ACTIVE =
  "bg-bg-muted text-ink-primary hover:bg-bg-muted data-active:bg-bg-muted data-active:text-ink-primary font-medium";

/** Sidebar thu gọn: danh sách icon phẳng (tooltip từng item), vạch ngăn giữa các nhóm. */
export function SidebarNavCollapsed({
  groups,
  activeHref,
  warningCounts,
}: {
  groups: readonly NavGroup[];
  activeHref: string | undefined;
  warningCounts: Record<string, number>;
}) {
  return (
    <SidebarMenu className="items-center gap-0.5">
      {groups.map((group, index) => (
        <div key={group.title} className="contents">
          {index > 0 && <div className="border-border-default mx-auto my-1.5 w-8 border-t" />}
          {group.items.map((item) => (
            <CollapsedItem
              key={item.href}
              item={item}
              active={item.href === activeHref}
              warnCount={warningCounts[item.href] ?? 0}
            />
          ))}
        </div>
      ))}
    </SidebarMenu>
  );
}

export function WarnBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-positive text-ink-inverse flex size-[18px] shrink-0 items-center justify-center rounded-full text-[0.5625rem] leading-none font-bold">
      {count}
    </span>
  );
}

function CollapsedItem({
  item,
  active,
  warnCount,
}: {
  item: NavItem;
  active: boolean;
  warnCount: number;
}) {
  return (
    <SidebarMenuItem className="w-8">
      <SidebarMenuButton
        asChild
        isActive={active}
        // Cùng tên với menu mở rộng (tiếng Việt)
        tooltip={item.label}
        className={cn(
          "h-auto justify-center gap-0 rounded-[var(--r-md)] transition-colors duration-150 group-data-[collapsible=icon]:overflow-visible [&>svg]:size-3.5",
          active ? ITEM_ACTIVE : ITEM_IDLE,
        )}
      >
        <Link href={item.href}>
          <item.icon className="size-3.5 shrink-0" />
        </Link>
      </SidebarMenuButton>
      {warnCount > 0 && (
        <span className="bg-positive ring-sidebar text-ink-inverse pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[0.5625rem] leading-none font-bold ring-2">
          {warnCount}
        </span>
      )}
    </SidebarMenuItem>
  );
}
