// Intl's significant-digit ceiling avoids a fixed decimal-place cutoff, even for tiny values.
const exactDisplay = new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 21 });
const NOISE_CHECK_DIGITS = 15;

/** Display only: never round saved data or infer purchasing precision. */
export function formatProcurementNumber(value: number): string {
  if (!Number.isInteger(value)) {
    const compact = Number(value.toPrecision(NOISE_CHECK_DIGITS));
    const difference = Math.abs(value - compact);
    if (difference > 0 && difference <= Number.EPSILON * Math.abs(value)) {
      // A machine-precision simplification is explicitly approximate; UI exposes the original.
      return `≈ ${exactDisplay.format(compact)}`;
    }
  }
  return exactDisplay.format(value);
}
