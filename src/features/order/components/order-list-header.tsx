import { BarChart3 } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

interface Props {
  showStats: boolean;
  onToggle: () => void;
}

export function OrderListHeaderActions({ showStats, onToggle }: Props) {
  return (
    <Button
      type="button"
      variant={showStats ? "secondary" : "outline"}
      size="sm"
      onClick={onToggle}
      className={cn(
        "rounded-[var(--r-sm)]",
        showStats &&
          "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
      )}
    >
      <BarChart3 className="size-3.5" />
      {showStats ? "Ẩn thống kê" : "Hiện thống kê"}
    </Button>
  );
}
