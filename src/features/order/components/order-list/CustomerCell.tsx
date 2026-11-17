"use client";

import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";

import { isValidOrderCustomerId } from "../../schemas";

interface CustomerCellProps {
  customerId: string | null;
  /** Tên khách BE kèm sẵn (BE-15); thiếu thì hiện mã khách, không hiện cả UUID. */
  customerName?: string | null;
  customerCode?: string | null;
  onFilter: (customerId: string) => void;
}

/**
 * Tên khách (mã khách ở dòng phụ / tooltip) + nút lọc nhanh theo khách. Bộ lọc BE chỉ nhận UUID →
 * id không phải UUID (vd dữ liệu mock `CUS-…`) chỉ hiển thị, không có nút lọc.
 */
export function CustomerCell({
  customerId,
  customerName,
  customerCode,
  onFilter,
}: CustomerCellProps) {
  if (!customerId) return <span className="text-ink-tertiary text-xs">—</span>;
  // Không tên, không mã: mã rút gọn của UUID; id không phải UUID (dữ liệu mock `CUS-…`) giữ nguyên.
  const shortId = isValidOrderCustomerId(customerId) ? `KH ${customerId.slice(0, 8)}` : customerId;
  const label = customerName || customerCode || shortId;
  const title = [customerName, customerCode, customerId].filter(Boolean).join(" · ");
  return (
    <span className="flex items-center gap-1">
      <span className="text-ink-secondary max-w-40 truncate text-[0.8125rem]" title={title}>
        {label}
      </span>
      {isValidOrderCustomerId(customerId) && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-ink-tertiary hover:text-ink-primary"
          aria-label={`Lọc đơn của khách ${customerName || customerCode || customerId}`}
          onClick={(event) => {
            event.stopPropagation();
            onFilter(customerId);
          }}
        >
          <Filter className="size-3" />
        </Button>
      )}
    </span>
  );
}
