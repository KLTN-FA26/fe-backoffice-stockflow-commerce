"use client";

import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CustomerCellProps {
  customerId: string | null;
  onFilter: (customerId: string) => void;
}

/** Mã khách + nút lọc nhanh theo khách (BE chỉ trả `customerId`, chưa có tên khách). */
export function CustomerCell({ customerId, onFilter }: CustomerCellProps) {
  if (!customerId) return <span className="text-ink-tertiary text-xs">—</span>;
  return (
    <span className="flex items-center gap-1">
      <span
        className="text-ink-secondary max-w-28 truncate font-[family-name:var(--font-mono)] text-xs"
        title={customerId}
      >
        {customerId}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-ink-tertiary hover:text-ink-primary"
        aria-label={`Lọc đơn của khách ${customerId}`}
        onClick={(event) => {
          event.stopPropagation();
          onFilter(customerId);
        }}
      >
        <Filter className="size-3" />
      </Button>
    </span>
  );
}
