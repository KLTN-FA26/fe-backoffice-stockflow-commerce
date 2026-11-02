"use client";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ReactNode } from "react";

/**
 * Nút chỉ có icon trong thanh nổi của bản đồ — nhãn ở tooltip và `aria-label` (icon-button phải có
 * nhãn); `pressed` = công cụ đang dùng (nền `brand`). `side` = phía hiện tooltip, tránh che bản đồ.
 */
export function IconTool({
  label,
  pressed,
  disabled,
  danger,
  side = "bottom",
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  danger?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "text-ink-primary hover:bg-bg-muted size-9 rounded-(--control-radius)",
            "aria-pressed:bg-brand aria-pressed:text-ink-inverse aria-pressed:hover:bg-brand-hover",
            danger && "text-danger hover:text-danger",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      {/* Lớp tooltip (trên lớp toàn màn hình của bản đồ — TooltipContent mặc định z-50 bị che) */}
      <TooltipContent side={side} className="z-(--z-tooltip)">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
