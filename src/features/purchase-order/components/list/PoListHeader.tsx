"use client";

import { BarChart3, FileText, Plus, Wallet } from "lucide-react";
import { cn } from "cn";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

export const PO_LIST_TABS = ["orders", "spend"] as const;
export type PoTabKey = (typeof PO_LIST_TABS)[number];

const TABS: { key: PoTabKey; label: string; icon: typeof FileText }[] = [
  { key: "orders", label: "Đơn đặt hàng", icon: FileText },
  { key: "spend", label: "Chi tiêu NCC", icon: Wallet },
];

export function PoListHeader({
  showStats,
  showStatsToggle,
  onToggleStats,
  onCreate,
}: {
  showStats: boolean;
  showStatsToggle: boolean;
  onToggleStats: () => void;
  onCreate: () => void;
}) {
  return (
    <PageHeader
      title="Đơn đặt NCC"
      subtitle="Theo dõi vòng đời PO, nhà cung cấp, giá trị và tiến độ nhận hàng."
      actions={
        <div className="flex items-center gap-2">
          {showStatsToggle && (
            <Button
              type="button"
              variant={showStats ? "secondary" : "outline"}
              size="sm"
              onClick={onToggleStats}
              className={cn(
                "rounded-[var(--r-sm)]",
                showStats &&
                  "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
              )}
            >
              <BarChart3 className="size-3.5" />
              {showStats ? "Ẩn thống kê" : "Hiện thống kê"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
          >
            <Plus className="size-3.5" />
            Tạo đơn đặt hàng
          </Button>
        </div>
      }
    />
  );
}

export function PoListTabs({
  active,
  orderCount,
  onChange,
}: {
  active: PoTabKey;
  orderCount: number;
  onChange: (tab: PoTabKey) => void;
}) {
  return (
    <div role="tablist" className="border-border-default mb-4 flex gap-0 border-b">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const Icon = tab.icon;
        return (
          <Button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            variant="ghost"
            onClick={() => onChange(tab.key)}
            className={cn(
              "hover:bg-bg-muted/60 h-auto rounded-none border-b-2 bg-transparent px-4 py-2 text-[0.8125rem] font-medium transition-colors",
              isActive
                ? "border-brand text-brand hover:text-brand"
                : "text-ink-tertiary hover:text-ink-primary border-transparent",
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
            {tab.key === "orders" && (
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                  isActive ? "bg-brand text-ink-inverse" : "bg-bg-muted text-ink-tertiary",
                )}
              >
                {orderCount}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
