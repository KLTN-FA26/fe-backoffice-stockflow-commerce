export const PROCUREMENT_NUMERIC_ERRORS = {
  malformed: "Nhập số hợp lệ.",
  overflow: "Số vượt khả năng biểu diễn.",
  negative: "Số không âm hợp lệ",
  unsafeInteger: "Số nguyên vượt độ chính xác hỗ trợ.",
} as const;

type QuantityIntegrity = "blank" | "valid" | keyof typeof PROCUREMENT_NUMERIC_ERRORS;
type QuantityField =
  "reorderPoint" | `suppliers.${number}.${"leadTimeDays" | "moq" | "orderMultiple"}`;

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Numeric representation checks only; no purchasing limits or integer-only field rules. */
export function inspectProcurementQuantity(raw: string): QuantityIntegrity {
  const value = raw.trim();
  if (value === "") return "blank";
  if (!DECIMAL_NUMBER.test(value)) return "malformed";
  const number = Number(value);
  if (!Number.isFinite(number)) return "overflow";
  if (number < 0) return "negative";
  if (Number.isInteger(number) && !Number.isSafeInteger(number)) return "unsafeInteger";
  return "valid";
}

function isQuantityField(name: string): name is QuantityField {
  return name === "reorderPoint" || /^suppliers\.\d+\.(leadTimeDays|moq|orderMultiple)$/.test(name);
}

/**
 * Native number inputs hide malformed/overflow text behind value="". Consult badInput
 * before the string resolver can mistake that state for a genuinely optional blank.
 */
export function invalidProcurementNumberFields(form: HTMLFormElement): QuantityField[] {
  const invalid: QuantityField[] = [];
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="number"]')) {
    if (input.validity.badInput && isQuantityField(input.name)) invalid.push(input.name);
  }
  return invalid;
}
