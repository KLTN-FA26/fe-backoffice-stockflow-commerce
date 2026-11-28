import { INVENTORY_LABELS } from "@/constants/inventory";

import { formatNumber } from "@/lib/format/number";

const { missing } = INVENTORY_LABELS;

/**
 * ADR-0011 (BE, issue #305): stock is counted in whole cartons — the carton count is the main figure, the units
 * it stands for sit under it in a quieter tone. A BE that leaves the carton figure out shows the units as before.
 */
export function CartonFigure({
  cartons,
  units,
}: {
  cartons?: number | null;
  units?: number | null;
}) {
  if (cartons == null) {
    return <span>{units == null ? missing : formatNumber(units)}</span>;
  }
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{INVENTORY_LABELS.cartonCount(cartons)}</span>
      {units != null && (
        <span className="text-ink-tertiary text-xs">{INVENTORY_LABELS.unitCount(units)}</span>
      )}
    </span>
  );
}
