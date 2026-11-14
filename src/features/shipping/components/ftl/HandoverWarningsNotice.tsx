"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { handoverBlockReason } from "@/features/shipping/handover-blocks";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { HandoverWarning } from "@/features/shipping/types";

const W = UI_LABELS.shipping.waybill.warnings;

/**
 * Cảnh báo lúc bắt đầu xếp (docs 09 §4.2 bước 7, BR-04): đơn trên xe còn đợt thanh toán trước khi giao chưa thu, hoặc đợt
 * giao chưa tới ngày bắt đầu cửa sổ giao, hoặc đơn đang treo. KHÔNG chặn xếp hàng — BE chỉ trả danh sách này trong câu trả
 * lời của "bắt đầu xếp", nên màn chuyến giữ nó tới khi người dùng ẩn / tải lại trang; việc chặn nằm ở bước ký bàn giao.
 */
export function HandoverWarningsNotice({
  warnings,
  onDismiss,
}: {
  warnings: readonly HandoverWarning[];
  onDismiss: () => void;
}) {
  if (warnings.length === 0) return null;
  return (
    <Alert tone="warning" title={W.title}>
      <p>{W.description}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {warnings.map((order) => (
          <li key={order.orderId}>
            <Link
              href={ADMIN_ROUTES.orders.detail(order.orderId)}
              className="font-medium underline"
            >
              {order.orderNumber}
            </Link>
            : {handoverBlockReason(order)}
          </li>
        ))}
      </ul>
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onDismiss}>
        {W.dismiss}
      </Button>
    </Alert>
  );
}
