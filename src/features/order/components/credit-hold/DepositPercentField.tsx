import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormFieldError } from "../FormFieldError";

import type { UseFormRegisterReturn } from "react-hook-form";

interface DepositPercentFieldProps {
  registration: UseFormRegisterReturn;
  error: string | undefined;
}

/** Tỷ lệ cọc khi chuyển đơn sang đặt cọc — BE CreditRefusalRequest.depositPercent (0, 100). */
export function DepositPercentField({ registration, error }: DepositPercentFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="credit-reject-deposit" className="text-ink-secondary text-xs font-medium">
        Tỷ lệ cọc (%) — bỏ trống để dùng mặc định của khách
      </Label>
      <Input
        id="credit-reject-deposit"
        type="number"
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "credit-reject-deposit-error" : undefined}
        className="w-32 tabular-nums"
        {...registration}
      />
      <FormFieldError id="credit-reject-deposit-error" message={error} />
    </div>
  );
}
