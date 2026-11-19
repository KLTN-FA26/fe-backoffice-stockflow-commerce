import { UI_LABELS } from "@/constants";
import { Checkbox } from "@/components/ui/checkbox";

import { MONO } from "../primitives";

import type { LoadShipment } from "@/features/shipping/types";

const R = UI_LABELS.shipping.afterHandover.removal;

interface RemovedShipmentsFieldProps {
  shipments: readonly LoadShipment[];
  value: readonly string[];
  disabled: boolean;
  onChange: (next: readonly string[]) => void;
}

/**
 * Chọn lô giao gỡ hẳn khỏi xe khi huỷ có kiểm soát (docs 09 §4.2 bước 9, BR-14; `REMOVED_FROM_VEHICLE`): lô được chọn
 * bị loại khỏi kế hoạch, chuyến mới chỉ chở các lô còn lại với sơ đồ tính lại. Một lô đi nguyên lô (BR-09). Không chọn
 * lô nào → giữ cùng sơ đồ như cũ.
 */
export function RemovedShipmentsField({
  shipments,
  value,
  disabled,
  onChange,
}: RemovedShipmentsFieldProps) {
  if (shipments.length === 0) return null;
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  const allRemoved = shipments.every((s) => value.includes(s.shipmentId));

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-[0.8125rem] font-medium">{R.label}</legend>
      <p className="text-ink-tertiary text-xs">{R.hint}</p>
      <ul className="space-y-1">
        {shipments.map((shipment) => (
          <li key={shipment.shipmentId}>
            <label className="text-ink-primary flex items-start gap-2 text-[0.8125rem]">
              <Checkbox
                checked={value.includes(shipment.shipmentId)}
                onCheckedChange={(next) => toggle(shipment.shipmentId, next === true)}
                aria-label={`${R.label}: ${shipment.code}`}
                className="mt-0.5"
              />
              <span>
                <span className={MONO}>{shipment.code}</span>
                {shipment.orderNumber && (
                  <span className="text-ink-secondary">
                    {" "}
                    · {R.order} <span className={MONO}>{shipment.orderNumber}</span>
                  </span>
                )}
                <span className="text-ink-tertiary">
                  {" "}
                  · {shipment.packageCount} {R.packages}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {allRemoved && <p className="text-warning text-xs">{R.allRemoved}</p>}
    </fieldset>
  );
}
