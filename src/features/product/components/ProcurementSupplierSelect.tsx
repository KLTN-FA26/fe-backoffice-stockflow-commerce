import type { ComponentProps } from "react";
import type { ProcurementSupplierChoice } from "../procurement-settings/form-model";

export function ProcurementSupplierSelect({
  choices,
  ...props
}: ComponentProps<"select"> & {
  choices: readonly ProcurementSupplierChoice[];
}) {
  return (
    <select
      className="border-border-default bg-bg-surface text-ink-primary focus-visible:ring-accent h-8 w-full rounded-sm border px-[var(--space-sm)] text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      {...props}
    >
      <option value="">Chưa chọn nhà cung cấp</option>
      {choices.map((supplier) => (
        <option key={supplier.supplierId} value={supplier.supplierId}>
          {supplier.supplierName}
        </option>
      ))}
    </select>
  );
}
