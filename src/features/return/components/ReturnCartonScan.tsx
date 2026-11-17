"use client";

import { useRef, useState } from "react";
import { ScanLine } from "lucide-react";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { useScanInput } from "@/hooks/use-scan-input";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Input } from "@/components/ui/input";

import { returnErrorMessage } from "../errors";
import { useScanReturnCarton } from "../mutations";

const D = RETURN_RECEIPT_LABELS.detail;

/**
 * Quét thùng hàng hoàn theo LPN (docs 03 §4.2 bước 10; BE `POST /goods-receipts/returns/{id}/cartons`): ô quét luôn
 * focus (mode-a §4.3), Enter gửi. Tình trạng thùng (móp, ướt…) gõ trước khi quét, gửi kèm thùng kế tiếp.
 */
export function ReturnCartonScan({ receiptId }: { receiptId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [condition, setCondition] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "positive" | "danger"; text: string } | null>(
    null,
  );
  const scan = useScanReturnCarton();
  const input = useScanInput(inputRef, {
    disabled: scan.isPending,
    onScan: (lpn) =>
      scan.mutate(
        { id: receiptId, lpn, condition },
        {
          onSuccess: () => {
            setFeedback({
              tone: "positive",
              text: `${RETURN_RECEIPT_LABELS.success.scanned}: ${lpn}`,
            });
            setCondition("");
          },
          onError: (failure) =>
            setFeedback({ tone: "danger", text: `${lpn}: ${returnErrorMessage(failure)}` }),
        },
      ),
  });

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
        <ScanLine className="size-3.5" aria-hidden /> {D.scan}
      </h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <label htmlFor="rr-scan" className="text-ink-secondary text-xs font-medium">
            {D.lpn}
          </label>
          <Input
            id="rr-scan"
            ref={inputRef}
            autoComplete="off"
            maxLength={RETURN_LIMITS.lpnMax}
            placeholder={D.scanPlaceholder}
            className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
            value={input.value}
            onChange={input.onChange}
            onBlur={input.onBlur}
            onKeyDown={input.onKeyDown}
            disabled={scan.isPending}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="rr-condition" className="text-ink-secondary text-xs font-medium">
            {D.condition}
          </label>
          <Input
            id="rr-condition"
            maxLength={RETURN_LIMITS.conditionMax}
            placeholder={D.conditionPlaceholder}
            className={FORM_INPUT_CLASS}
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
          />
        </div>
      </div>
      {feedback && (
        <Notice tone={feedback.tone} live>
          {feedback.text}
        </Notice>
      )}
    </Card>
  );
}
