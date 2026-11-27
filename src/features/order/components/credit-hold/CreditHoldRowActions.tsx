"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { useCreditApproveDialog } from "./CreditApproveAction";
import { useCreditRejectDialog } from "./CreditRejectAction";

import type { CreditHoldTarget } from "./types";

/**
 * Ô "Thao tác" của hàng đợi vượt hạn mức (backoffice-erp-ui A6): menu "⋯" gồm "Duyệt công nợ" và "Từ chối" (chữ đỏ,
 * cuối — từ chối huỷ đơn). `canApprove` / `canReject` là gate của `allowedOrderActions` (UI-only, BE re-check).
 */
export function CreditHoldRowActions({
  order,
  canApprove,
  canReject,
  onRejected,
}: {
  order: CreditHoldTarget;
  canApprove: boolean;
  canReject: boolean;
  onRejected: (order: CreditHoldTarget) => void;
}) {
  const approve = useCreditApproveDialog(order);
  const reject = useCreditRejectDialog(order, onRejected);
  const actions = [
    ...(canApprove
      ? [
          {
            label: UI_LABELS.order.actions.creditApprove,
            icon: CheckCircle2,
            disabled: approve.isPending,
            onSelect: approve.show,
          },
        ]
      : []),
    ...(canReject
      ? [
          {
            label: UI_LABELS.order.actions.creditReject,
            icon: XCircle,
            disabled: reject.isPending,
            danger: true,
            onSelect: reject.show,
          },
        ]
      : []),
  ];
  return (
    <RowActionsMenu label={`Thao tác — ${order.orderNumber}`} actions={actions}>
      {canApprove && approve.dialog}
      {canReject && reject.dialog}
    </RowActionsMenu>
  );
}
