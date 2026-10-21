"use client";

import { useState } from "react";
import { cn } from "cn";
import { Check, ChevronsUpDown, Warehouse as WarehouseIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface WarehouseOption {
  warehouseId: string;
  code: string;
  name: string;
}

const ALL = "all";
const ALL_LABEL = "Tất cả kho";
const MENU_ITEM =
  "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary h-auto w-full justify-start gap-2 rounded-none bg-transparent px-3 py-1.5 text-left text-[0.8125rem] font-normal transition-colors";

/**
 * Chọn kho ở đầu sidebar (trên ô search): mở rộng thì hiện mã + tên kho đang xem, thu gọn chỉ
 * còn icon + tooltip. Chỉ hiện ở mock — danh sách kho mẫu, chưa nối phạm vi dữ liệu BE.
 * TODO: state nên chuyển sang useAppStore.warehouseId (đã có persist) để F5 không mất lựa chọn —
 * xem .claude/rules/state-persistence.md.
 */
export function SidebarWarehouseSwitcher({
  warehouses,
}: {
  warehouses: readonly WarehouseOption[];
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [selected, setSelected] = useState(ALL);
  const [open, setOpen] = useState(false);
  const current = warehouses.find((w) => w.warehouseId === selected);
  const ariaLabel = `Kho đang xem: ${current ? `${current.code} · ${current.name}` : ALL_LABEL}`;

  const pick = (id: string) => {
    setSelected(id);
    setOpen(false);
  };

  const trigger = collapsed ? (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setOpen((o) => !o)}
      aria-label={ariaLabel}
      aria-expanded={open}
      className="text-ink-secondary hover:bg-bg-muted hover:text-ink-primary size-8 rounded-[var(--r-sm)] bg-transparent p-0"
    >
      <WarehouseIcon className="size-4" />
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      onClick={() => setOpen((o) => !o)}
      aria-label={ariaLabel}
      aria-expanded={open}
      className="border-border-default bg-bg-surface hover:bg-bg-muted h-9 w-full min-w-0 justify-start gap-2 rounded-[var(--r-sm)] px-2.5 font-normal shadow-none"
    >
      <WarehouseIcon className="text-ink-tertiary size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left">
        {current ? (
          <>
            <span className="text-ink-tertiary shrink-0 font-[family-name:var(--font-mono)] text-xs">
              {current.code}
            </span>
            <span className="text-ink-primary truncate text-[0.8125rem] font-medium">
              {current.name}
            </span>
          </>
        ) : (
          <span className="text-ink-primary truncate text-[0.8125rem] font-medium">
            {ALL_LABEL}
          </span>
        )}
      </span>
      <ChevronsUpDown className="text-ink-tertiary size-3.5 shrink-0" />
    </Button>
  );

  return (
    <div className={cn("relative", !collapsed && "w-full")}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{ariaLabel}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-[800]" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "border-border-default bg-bg-surface absolute z-[801] w-64 rounded-[var(--r-md)] border py-1 shadow-[var(--sh-lg)]",
              collapsed ? "top-0 left-full ml-2" : "top-full left-0 mt-1",
            )}
          >
            <div className="text-ink-tertiary border-border-default mb-1 border-b px-3 pt-1 pb-2 text-xs font-medium">
              Kho đang xem
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => pick(ALL)}
              className={cn(MENU_ITEM, selected === ALL && "text-ink-primary font-medium")}
            >
              <span className="flex-1">{ALL_LABEL}</span>
              {selected === ALL && <Check className="size-3.5" />}
            </Button>
            {warehouses.map((wh) => (
              <Button
                key={wh.warehouseId}
                type="button"
                variant="ghost"
                onClick={() => pick(wh.warehouseId)}
                className={cn(
                  MENU_ITEM,
                  selected === wh.warehouseId && "text-ink-primary font-medium",
                )}
              >
                <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                  {wh.code}
                </span>
                <span className="flex-1 truncate">{wh.name}</span>
                {selected === wh.warehouseId && <Check className="size-3.5" />}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
