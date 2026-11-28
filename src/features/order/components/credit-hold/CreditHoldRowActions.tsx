"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Button } from "@/components/ui/button";

import { CREDIT_HOLD_COPY } from "./copy";

import { useCreditApproveDialog } from "./CreditApproveAction";
import { useCreditRejectDialog } from "./CreditRejectAction";

import type { CreditHoldTarget } from "./types";

/**
 * Ô "Thao tác" của hàng đợi vượt hạn mức: việc chính "Duyệt" là nút ngay trên dòng (bo-21 — hàng chờ chỉ có một việc
 * chính, giấu trong "⋯" thì Kế toán phải bấm hai lần mỗi đơn); "Từ chối" (chữ đỏ — từ chối huỷ đơn) vẫn trong menu "⋯"
 * để không bấm nhầm cạnh nút duyệt. `canApprove` / `canReject` là gate của `allowedOrderActions` (UI-only, BE re-check).
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
    <div className="flex items-center justify-end gap-1">
      {canApprove && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={CREDIT_HOLD_COPY.approveLabel(order.orderNumber)}
          disabled={approve.isPending}
          onClick={(event) => {
            event.stopPropagation();
            approve.show();
          }}
        >
          <CheckCircle2 className="text-dot-positive size-3" aria-hidden="true" />
          {CREDIT_HOLD_COPY.approve}
        </Button>
      )}
      <RowActionsMenu label={`Thao tác — ${order.orderNumber}`} actions={actions}>
        {canReject && reject.dialog}
      </RowActionsMenu>
      {canApprove && approve.dialog}
    </div>
  );
}
