"use client";

import { useRef, useState } from "react";
import { ScanLine } from "lucide-react";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { ApiError } from "@/lib/api/error";
import { useScanInput } from "@/hooks/use-scan-input";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { returnErrorMessage } from "../errors";
import { useScanReturnCarton } from "../mutations";

import type { ExpectedCarton } from "../types";

const D = RETURN_RECEIPT_LABELS.detail;
type Feedback = { tone: "positive" | "danger"; text: string };

/** Số đếm của thùng đã mở: số nguyên ≥ 0, không vượt nhãn khi biết thùng (BE `ScanReturnCartonRequest`). */
function countedProblem(raw: string, label: number | undefined): string | null {
  const value = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(value) || value < 0) return D.countedRequired;
  return label !== undefined && value > label ? D.countedAboveLabel : null;
}

/**
 * Quét thùng hàng hoàn theo LPN (docs 03 §4.2 bước 10; BE `POST /goods-receipts/returns/{id}/cartons`): ô quét luôn
 * focus (mode-a §4.3), Enter gửi. Tình trạng thùng (móp, ướt…) gõ trước khi quét, gửi kèm thùng kế tiếp. WF-05 TH-4:
 * "Thùng đã mở" mở ô "Số đếm thực tế" (bắt buộc khi bật) — gửi `countedQuantity`; tắt = thùng nguyên, không gửi.
 */
export function ReturnCartonScan({
  receiptId,
  expectedCartons,
}: {
  receiptId: string;
  expectedCartons: readonly ExpectedCarton[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [condition, setCondition] = useState("");
  const [opened, setOpened] = useState(false);
  const [counted, setCounted] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const scan = useScanReturnCarton();
  const onScan = (lpn: string) => {
    const label = expectedCartons.find((carton) => carton.lpn === lpn)?.quantity;
    const problem = opened ? countedProblem(counted, label) : null;
    if (problem) {
      setFeedback({ tone: "danger", text: `${lpn}: ${problem}` });
      return;
    }
    const countedQuantity = opened ? Number(counted) : undefined;
    scan.mutate(
      { id: receiptId, lpn, condition, countedQuantity },
      {
        onSuccess: () => {
          setFeedback({
            tone: "positive",
            text: `${RETURN_RECEIPT_LABELS.success.scanned}: ${lpn}`,
          });
          setCondition("");
          setOpened(false);
          setCounted("");
        },
        onError: (failure) => {
          // Số đếm vượt nhãn: BE trả VALIDATION_FAILED chung
          const aboveLabel =
            countedQuantity !== undefined &&
            failure instanceof ApiError &&
            failure.code === "VALIDATION_FAILED";
          const text = aboveLabel ? D.countedAboveLabel : returnErrorMessage(failure);
          setFeedback({ tone: "danger", text: `${lpn}: ${text}` });
        },
      },
    );
  };
  const input = useScanInput(inputRef, { disabled: scan.isPending, onScan });

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="text-ink-secondary flex min-h-11 items-center gap-2 text-[0.8125rem]">
          <Checkbox checked={opened} onCheckedChange={(next) => setOpened(next === true)} />
          {D.opened}
        </label>
        {opened && (
          <div className="flex items-center gap-2">
            <label htmlFor="rr-counted" className="text-ink-secondary text-xs font-medium">
              {D.counted}
            </label>
            <Input
              id="rr-counted"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              className={`${FORM_INPUT_CLASS} w-24 tabular-nums`}
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
            />
          </div>
        )}
      </div>
      {feedback && (
        <Notice tone={feedback.tone} live>
          {feedback.text}
        </Notice>
      )}
    </Card>
  );
}
