"use client";

import { BarChart3, Plus } from "lucide-react";
import { cn } from "cn";

import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

export function PoListHeader({
  showStats,
  stats,
  onToggleStats,
  onCreate,
}: {
  showStats: boolean;
  stats: readonly { label: string; value: string; icon?: unknown }[];
  onToggleStats: () => void;
  onCreate: () => void;
}) {
  return (
    <>
      <PageHeader
        title="Đơn đặt NCC"
        subtitle="Theo dõi vòng đời PO, nhà cung cấp, giá trị và tiến độ nhận hàng."
        actions={
          <div className="flex items-center gap-2">
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
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={onCreate}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Tạo đơn đặt hàng
            </Button>
          </div>
        }
      />
      <ListStatsPanel
        stats={stats as never}
        open={showStats}
        gridClassName="lg:grid-cols-4 xl:grid-cols-7"
      />
    </>
  );
}
