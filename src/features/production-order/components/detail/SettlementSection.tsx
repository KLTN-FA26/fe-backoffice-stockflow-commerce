"use client";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";

import { canApproveLoss } from "@/features/production-order/lifecycle";

import { MONO } from "../copy";
import { LossApprovalForm } from "./SubcontractForms";

import type { ProductionDetail, Settlement } from "@/features/production-order/types";

/** Quyết toán gia công (BR-PRD-17): số nhận / đạt / hao hụt vượt dung sai + duyệt khấu trừ QA1. */
export function SettlementSection({
  order,
  settlement,
}: {
  order: ProductionDetail;
  settlement: Settlement;
}) {
  const can = usePermissionChecker();
  return (
    <section aria-labelledby="settlement" className="space-y-2">
      <h3 id="settlement" className="text-ink-primary text-[0.8125rem] font-semibold">
        Quyết toán ({settlement.status === "FINAL" ? "đã chốt" : "chờ duyệt hao hụt"})
      </h3>
      <p className={`text-ink-secondary ${MONO}`}>
        Nhận {formatNumber(settlement.receivedQuantity)} · đạt{" "}
        {formatNumber(settlement.passedQuantity)} · phôi gửi {formatNumber(settlement.blanksSent)} ·
        mất {formatNumber(settlement.blanksLost)} (dung sai {settlement.tolerancePercent}% ={" "}
        {formatNumber(settlement.toleranceBlanks)}, vượt {formatNumber(settlement.excessLoss)})
      </p>
      <p className={MONO}>
        Phải trả {formatMoney(settlement.payableAmount, settlement.currency)} − khấu trừ{" "}
        {formatMoney(settlement.deductionAmount ?? 0, settlement.currency)} + phí huỷ{" "}
        {formatMoney(settlement.cancellationFee ?? 0, settlement.currency)} ={" "}
        <strong>{formatMoney(settlement.netPayable, settlement.currency)}</strong>
      </p>
      {canApproveLoss(settlement, can) && <LossApprovalForm order={order} />}
    </section>
  );
}
