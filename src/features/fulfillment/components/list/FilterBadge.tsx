"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Badge một bộ lọc đang bật trên thanh "Cấu hình", có nút X xoá riêng (cùng kiểu `ListConfigSummary`). */
export function FilterBadge({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
      {label}: {value}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onClear}
        aria-label={`Xoá ${label}`}
        className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full p-0"
      >
        <X className="size-3" />
      </Button>
    </Badge>
  );
}
