/**
 * MST gốc (BE `TaxCode.root`, review P4): 10 số đầu của MST doanh nghiệp (`0312345678` hoặc đơn vị phụ thuộc
 * `0312345678-001`). Số CCCD 12 số của hộ kinh doanh không có gốc → `null`. Chỉ mock dùng.
 */
export function taxCodeRoot(taxCode: string): string | null {
  const compact = taxCode.trim().replace(/[\s.]/g, "");
  const match = /^(\d{10})(?:-?\d{3})?$/.exec(compact);
  return match?.[1] ?? null;
}
