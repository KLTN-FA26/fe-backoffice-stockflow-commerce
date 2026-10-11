import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DepositPercentFieldProps {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

/** Tỷ lệ cọc khi chuyển đơn sang đặt cọc — BE CreditRefusalRequest.depositPercent (0, 100). */
export function DepositPercentField({ value, error, onChange }: DepositPercentFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="credit-reject-deposit" className="text-ink-secondary text-xs font-medium">
        Tỷ lệ cọc (%) — bỏ trống để dùng mặc định của khách
      </Label>
      <Input
        id="credit-reject-deposit"
        type="number"
        inputMode="decimal"
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? "credit-reject-deposit-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-32 tabular-nums"
      />
      {error && (
        <p id="credit-reject-deposit-error" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
