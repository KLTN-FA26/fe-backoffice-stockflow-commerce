import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormFieldError } from "./FormFieldError";

import type { UseFormRegisterReturn } from "react-hook-form";

interface RetainedPercentFieldProps {
  registration: UseFormRegisterReturn;
  /** Giá trị hiện tại (useWatch) — để xem trước số tiền. */
  value: string;
  paidAmount: number;
  currency: string;
  error: string | undefined;
}

/**
 * % giữ lại từ tiền đã thu khi huỷ — BE `AdminCancelOrderRequest.retainedPercent` 0..100 (vd phí
 * sản xuất đã in, docs 19 BR-10). Bỏ trống = không giữ lại. Số tiền xem trước chỉ để tham khảo;
 * BE tính `retainedAmount` thật.
 */
export function RetainedPercentField({
  registration,
  value,
  paidAmount,
  currency,
  error,
}: RetainedPercentFieldProps) {
  const percent = Number(value);
  const preview = value.trim() !== "" && !error && Number.isFinite(percent);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="cancel-retained" className="text-ink-secondary text-xs font-medium">
        Giữ lại (%) từ {formatMoney(paidAmount, currency)} đã thu
      </Label>
      <div className="flex items-center gap-3">
        <Input
          id="cancel-retained"
          type="number"
          inputMode="decimal"
          placeholder="0"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "cancel-retained-error" : undefined}
          className="w-28 tabular-nums"
          {...registration}
        />
        {preview && (
          <span className="text-ink-secondary font-mono text-xs tabular-nums">
            ≈ {formatMoney(Math.round((paidAmount * percent) / 100), currency)}
          </span>
        )}
      </div>
      <FormFieldError id="cancel-retained-error" message={error} />
    </div>
  );
}
