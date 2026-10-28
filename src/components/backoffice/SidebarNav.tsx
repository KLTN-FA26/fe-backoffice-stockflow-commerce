"use client";

import { useState } from "react";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { UI_LABELS } from "@/constants";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { ITEM_ACTIVE, ITEM_IDLE, SidebarNavCollapsed, WarnBadge } from "./SidebarNavCollapsed";

import type { NavGroup, NavItem } from "./BackofficeShell";

interface SidebarNavProps {
  groups: readonly NavGroup[];
  /** href của menu đang mở (khớp dài nhất với pathname). */
  activeHref: string | undefined;
  canSeeItem: (item: NavItem) => boolean;
  warningCounts: Record<string, number>;
  collapsed: boolean;
}

const ROW =
  "h-9 gap-2.5 rounded-[var(--r-md)] px-3 text-sm transition-colors duration-150 [&>svg]:size-3.5";
// Đổi màn cha ↔ con: trượt + mờ nhẹ 150ms (Mode A), tắt khi giảm chuyển động
const PANEL_IN =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 motion-safe:slide-in-from-right-2";

/**
 * Menu sidebar kiểu Vercel (drill-down): màn gốc là các item cha; bấm một item cha thì danh sách
 * được thay bằng các item con của nó, đầu có nút quay lại màn gốc. Đang ở trang thuộc nhóm nào thì
 * mở sẵn màn con của nhóm đó. Nhóm chỉ có một item thấy được → item đó là link thẳng ở màn gốc.
 * Sidebar thu gọn → danh sách icon phẳng như cũ (tooltip từng item).
 */
export function SidebarNav({
  groups,
  activeHref,
  canSeeItem,
  warningCounts,
  collapsed,
}: SidebarNavProps) {
  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter(canSeeItem) }))
    .filter((group) => group.items.length > 0);
  const activeGroup = visible.find(
    (g) => g.items.length > 1 && g.items.some((i) => i.href === activeHref),
  )?.title;

  // Chuyển sang trang thuộc nhóm khác → mở màn con của nhóm đó; còn lại do người dùng bấm
  const [panel, setPanel] = useState(activeGroup);
  const [lastActive, setLastActive] = useState(activeGroup);
  if (activeGroup !== lastActive) {
    setLastActive(activeGroup);
    setPanel(activeGroup);
  }

  if (collapsed) {
    return (
      <SidebarNavCollapsed groups={visible} activeHref={activeHref} warningCounts={warningCounts} />
    );
  }

  const current = visible.find((g) => g.title === panel && g.items.length > 1);
  const warnOf = (items: readonly NavItem[]) =>
    items.reduce((n, i) => n + (warningCounts[i.href] ?? 0), 0);

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        {current ? (
          <SidebarMenu key={current.title} className={cn("gap-0.5", PANEL_IN)}>
            {/* Tên item cha chính là nút quay lại màn gốc */}
            <SidebarMenuItem className="mb-1">
              <SidebarMenuButton
                type="button"
                onClick={() => setPanel(undefined)}
                aria-label={`${UI_LABELS.shell.navBack} ${current.title}`}
                className={cn(ROW, "text-ink-primary hover:bg-bg-muted font-semibold")}
              >
                <ChevronLeft className="text-ink-tertiary size-3.5 shrink-0" />
                <span className="truncate">{current.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {current.items.map((item) => (
              <NavLinkItem
                key={item.href}
                item={item}
                active={item.href === activeHref}
                warnCount={warningCounts[item.href] ?? 0}
              />
            ))}
          </SidebarMenu>
        ) : (
          <SidebarMenu key="root" className={cn("gap-0.5", panel === undefined && PANEL_IN)}>
            {visible.map((group) => {
              const [single] = group.items;
              if (group.items.length === 1 && single) {
                return (
                  <NavLinkItem
                    key={group.title}
                    item={single}
                    active={single.href === activeHref}
                    warnCount={warningCounts[single.href] ?? 0}
                  />
                );
              }
              return (
                <SidebarMenuItem key={group.title}>
                  <SidebarMenuButton
                    type="button"
                    onClick={() => setPanel(group.title)}
                    className={cn(ROW, group.title === activeGroup ? ITEM_ACTIVE : ITEM_IDLE)}
                  >
                    <group.icon className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate">{group.title}</span>
                    <WarnBadge count={warnOf(group.items)} />
                    <ChevronRight className="text-ink-tertiary size-3.5 shrink-0" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavLinkItem({
  item,
  active,
  warnCount,
}: {
  item: NavItem;
  active: boolean;
  warnCount: number;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(ROW, active ? ITEM_ACTIVE : ITEM_IDLE)}
      >
        <Link href={item.href}>
          <item.icon className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          <WarnBadge count={warnCount} />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
