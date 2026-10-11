import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RetainedPercentFieldProps {
  value: string;
  paidAmount: number;
  currency: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

/**
 * % giữ lại từ tiền đã thu khi huỷ — BE `AdminCancelOrderRequest.retainedPercent` 0..100 (vd phí
 * sản xuất đã in, docs 19 BR-10). Bỏ trống = không giữ lại. Số tiền xem trước chỉ để tham khảo;
 * BE tính `retainedAmount` thật.
 */
export function RetainedPercentField({
  value,
  paidAmount,
  currency,
  error,
  onChange,
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
          value={value}
          placeholder="0"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "cancel-retained-error" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="w-28 tabular-nums"
        />
        {preview && (
          <span className="text-ink-secondary font-mono text-xs tabular-nums">
            ≈ {formatMoney(Math.round((paidAmount * percent) / 100), currency)}
          </span>
        )}
      </div>
      {error && (
        <p id="cancel-retained-error" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
