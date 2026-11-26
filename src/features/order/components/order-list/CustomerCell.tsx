"use client";

import { Filter } from "lucide-react";

import { CUSTOMER_FALLBACK_LABEL } from "@/constants";
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
  // Không tên, không mã: nhãn trung tính — mảnh UUID không phải mã khách ai đọc được (BO-UX-6); id không phải UUID
  // (dữ liệu mock `CUS-…`) là mã đọc được nên giữ nguyên.
  const fallback = isValidOrderCustomerId(customerId) ? CUSTOMER_FALLBACK_LABEL : customerId;
  const label = customerName || customerCode || fallback;
  // Tooltip chỉ mang tên / mã khách, không UUID
  const title = [customerName, customerCode].filter(Boolean).join(" · ") || undefined;
  return (
    <span className="flex items-center gap-1">
      {/* Tên khách dài xuống tối đa 2 dòng thay vì bị cắt giữa chừng; tên đầy đủ ở chú thích (UX audit S05-1) */}
      <span
        className="text-ink-secondary line-clamp-2 max-w-56 text-[0.8125rem] leading-snug break-words"
        title={title}
      >
        {label}
      </span>
      {isValidOrderCustomerId(customerId) && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-ink-tertiary hover:text-ink-primary"
          // Không tên / mã: "khách này" — không đọc UUID cho trình đọc màn hình (BO-UX-6)
          aria-label={`Lọc đơn của khách ${customerName || customerCode || "này"}`}
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
