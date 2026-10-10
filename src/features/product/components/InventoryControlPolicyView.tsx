import { formatNumber } from "@/lib/format/number";

import {
  INVENTORY_CONTROL_TEXT as text,
  REMOVAL_STRATEGY_LABELS,
  TRACKING_MODE_LABELS,
} from "../inventory-control/constants";

import type { InventoryControlViewModel } from "../inventory-control/view-model";

export function InventoryControlPolicyView({
  value,
  showPolicy = true,
}: {
  value: InventoryControlViewModel;
  showPolicy?: boolean;
}) {
  const { policy, evaluation, context } = value;
  const quantity = (n: number | null) => (n === null ? text.unconfigured : formatNumber(n));
  const boolean = (flag: boolean | null) =>
    flag === null ? text.unknown : flag ? text.yes : text.no;
  const groups = [
    {
      title: text.policy,
      rows: [
        [text.reorderPoint, quantity(policy.reorderPoint)],
        [text.safetyStock, quantity(policy.safetyStock)],
        [text.removalStrategy, REMOVAL_STRATEGY_LABELS[policy.removalStrategy]],
        [text.trackingMode, TRACKING_MODE_LABELS[policy.trackingMode]],
        [text.expiryTracked, boolean(policy.expiryTracked)],
        [
          text.maxShelfLifeDays,
          policy.maxShelfLifeDays === null
            ? text.unconfigured
            : `${formatNumber(policy.maxShelfLifeDays)} ${text.days}`,
        ],
      ],
    },
    {
      title: text.evaluation,
      rows: [
        [text.usableOnHand, `${formatNumber(evaluation.usableOnHand)} ${context.unitOfMeasure}`],
        [text.reorderRequired, boolean(evaluation.reorderRequired)],
        [text.belowSafetyStock, boolean(evaluation.belowSafetyStock)],
      ],
    },
  ];
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {groups
        .filter((group) => showPolicy || group.title === text.evaluation)
        .map((group) => (
          <section key={group.title} aria-label={group.title} className="min-w-0 space-y-2">
            <h3 className="text-ink-primary text-sm font-semibold">{group.title}</h3>
            <dl className="space-y-2 text-sm">
              {group.rows.map(([label, rendered]) => (
                <div key={label}>
                  <dt className="text-ink-tertiary">{label}</dt>
                  <dd className="text-ink-primary break-words tabular-nums">{rendered}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
    </div>
  );
}
