"use client";

import { BarChart3, FileText, Plus, Wallet } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTabs } from "@/components/shared/PageTabs";
import { Button } from "@/components/ui/button";

export const PO_LIST_TABS = ["orders", "spend"] as const;
/** `idPrefix` chung của thanh tab và `PageTabPanel` ở `PurchaseOrderList`. */
export const PO_LIST_TAB_ID_PREFIX = "po-list";
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
  /** Chỉ truyền khi có quyền CREATE — không có thì ẩn nút tạo. */
  onCreate?: () => void;
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
          {onCreate && (
            <Button
              type="button"
              size="sm"
              onClick={onCreate}
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              {UI_LABELS.purchaseOrder.createAction}
            </Button>
          )}
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
  // Thanh tab dùng chung (kiểu Tabs shadcn) — đồng bộ với màn Thuộc tính, Thương hiệu & danh mục
  return (
    <PageTabs
      tabs={TABS.map((tab) => ({
        value: tab.key,
        label: tab.label,
        icon: tab.icon,
        count: tab.key === "orders" ? orderCount : undefined,
      }))}
      value={active}
      onChange={onChange}
      idPrefix={PO_LIST_TAB_ID_PREFIX}
      ariaLabel="Đơn đặt NCC"
    />
  );
}
