"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

const F = CUSTOMER_PRICE_UI_LABELS.form;

/** Câu khoá form khi khách trên URL đã đổi: quay lại khách của bản nháp, hoặc bỏ bản nháp. */
export function CustomerChangedLock({
  customerLabel,
  onReturn,
  onDiscard,
}: {
  customerLabel: string;
  onReturn: () => void;
  onDiscard: () => void;
}) {
  return (
    <div role="alert" className="space-y-2">
      <p className="text-warning text-xs">{F.customerChanged(customerLabel)}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReturn}>
          {F.returnToCustomer}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
          {F.discard}
        </Button>
      </div>
    </div>
  );
}
