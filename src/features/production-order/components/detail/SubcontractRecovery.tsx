"use client";

import { useState } from "react";

import { MATERIAL_ISSUE_PERMISSIONS } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { allowedSubcontractRecovery } from "@/features/production-order/lifecycle";
import { useSubcontractRecalls } from "@/features/production-order/queries";

import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { MONO } from "../copy";
import { RecallForm } from "./SubcontractRecoveryForms";
import { QuantityReasonForm } from "./QuantityReasonForm";

import type { SubcontractRecoveryAction } from "@/features/production-order/lifecycle";
import type { ProductionDetail } from "@/features/production-order/types";

const LABEL: Record<SubcontractRecoveryAction, string> = {
  recall: "Thu hồi phôi",
  inHouse: "Chuyển về xưởng",
  supplement: "Đặt thêm gia công",
};

/** Xử lý sự cố gia công: thu hồi phôi, chuyển về xưởng, đặt thêm (gated bởi lifecycle). */
export function SubcontractRecovery({ order }: { order: ProductionDetail }) {
  const can = usePermissionChecker();
  const [open, setOpen] = useState<SubcontractRecoveryAction | null>(null);
  const recalls = useSubcontractRecalls(order.summary.id, can(MATERIAL_ISSUE_PERMISSIONS.read));
  const actions = allowedSubcontractRecovery(order, can);
  const close = () => setOpen(null);
  return (
    <section aria-labelledby="sub-recovery" className="space-y-2">
      <h3 id="sub-recovery" className="text-ink-primary text-[0.8125rem] font-semibold">
        Xử lý sự cố gia công
      </h3>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action} size="sm" variant="outline" onClick={() => setOpen(action)}>
              {LABEL[action]}
            </Button>
          ))}
        </div>
      )}
      {recalls.data?.map((recall) => (
        <p key={recall.id} className={`text-ink-secondary ${MONO}`}>
          {formatDateTime(recall.recordedAt)}: trả {formatNumber(recall.returned)} · hỏng{" "}
          {formatNumber(recall.spoilt)}
          {recall.returnLocation ? ` → ${recall.returnLocation}` : ""}
        </p>
      ))}
      <FormDialog open={open !== null} onOpenChange={(value) => !value && close()}>
        {open === "recall" && <RecallForm order={order} onClose={close} />}
        {(open === "inHouse" || open === "supplement") && (
          <QuantityReasonForm order={order} kind={open} onClose={close} />
        )}
      </FormDialog>
    </section>
  );
}
