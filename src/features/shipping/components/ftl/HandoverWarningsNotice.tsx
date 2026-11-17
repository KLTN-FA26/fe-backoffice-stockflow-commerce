"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { handoverBlockReason } from "@/features/shipping/handover-blocks";
import { Alert } from "@/components/shared/Alert";

import type { HandoverWarning } from "@/features/shipping/types";

const W = UI_LABELS.shipping.waybill.warnings;

/**
 * Cảnh báo lúc bắt đầu xếp (docs 09 §4.2 bước 7, BR-04): đơn trên xe còn đợt thanh toán trước khi giao chưa thu, hoặc đợt
 * giao chưa tới ngày bắt đầu cửa sổ giao, hoặc đơn đang treo. KHÔNG chặn xếp hàng; việc chặn nằm ở bước ký bàn giao.
 * BE tính lại danh sách này ở mỗi lần đọc chuyến khi xe đang xếp (`Load.handoverWarnings`, quyết định WF4-A7-WARN): luôn
 * hiện cảnh báo còn hiệu lực, không cho ẩn; thu đủ tiền / tới ngày giao thì tự biến mất.
 */
export function HandoverWarningsNotice({ warnings }: { warnings: readonly HandoverWarning[] }) {
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
    </Alert>
  );
}
