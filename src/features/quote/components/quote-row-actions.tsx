"use client";

import { Eye, ShoppingCart } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { QUOTE_LIST_LABELS as L } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { QuoteRow } from "@/features/quote/types";

/**
 * Cột "Thao tác" (backoffice-erp-ui A6): xem chi tiết, mở đơn đã tạo. Sửa / gửi / huỷ / tạo đơn chỉ làm ở trang chi tiết:
 * dòng danh sách thiếu cờ `legacy` (báo giá cũ trước rescope không sửa được — BE QUOTE_LINES_LEGACY) và các thao tác đó
 * cần dialog, nên menu dòng không đoán thay `allowedStaffQuoteActions`.
 */
function quoteRowActions(row: QuoteRow): RowAction[] {
  const actions: RowAction[] = [
    { label: "Xem chi tiết", icon: Eye, href: ADMIN_ROUTES.quotes.detail(row.id) },
  ];
  if (row.convertedOrderId)
    actions.push({
      label: L.openOrder,
      icon: ShoppingCart,
      href: ADMIN_ROUTES.orders.detail(row.convertedOrderId),
    });
  return actions;
}

export function quoteActionsColumn(): ColumnDef<QuoteRow> {
  return rowActionsColumn<QuoteRow>((row) => ({
    label: `Thao tác — ${row.quoteNumber}`,
    actions: quoteRowActions(row),
  }));
}
