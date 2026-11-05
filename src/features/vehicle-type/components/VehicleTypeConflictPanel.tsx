"use client";

import { UI_LABELS, VEHICLE_TYPE_KIND_LABELS, VEHICLE_TYPE_STATUS_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { FormConflict } from "@/features/vehicle-type/form-defaults";

const L = UI_LABELS.vehicleType;
const F = L.form;

/** Hiện giá trị dễ đọc: loại / trạng thái theo nhãn tiếng Việt, ô trống là "—". */
function display(field: FormConflict["field"], value: string): string {
  if (value === "") return L.noPrice;
  if (field === "kind")
    return VEHICLE_TYPE_KIND_LABELS[value as keyof typeof VEHICLE_TYPE_KIND_LABELS] ?? value;
  if (field === "status")
    return VEHICLE_TYPE_STATUS_LABELS[value as keyof typeof VEHICLE_TYPE_STATUS_LABELS] ?? value;
  return value;
}

/**
 * Sau 409 OPTIMISTIC_LOCK: cạnh nhau giá trị của người dùng và bản mới của BE ở các ô khác nhau. Không ô
 * nào bị bỏ âm thầm — người dùng chọn giữ phần mình (lưu tiếp ghi đè) hoặc nạp lại dữ liệu mới.
 */
export function VehicleTypeConflictPanel({
  conflicts,
  onReload,
  onKeep,
}: {
  conflicts: FormConflict[];
  onReload: () => void;
  onKeep: () => void;
}) {
  return (
    <section
      role="status"
      aria-label={F.conflictTitle}
      className="border-warning bg-warning/5 space-y-2 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]"
    >
      <h3 className="text-ink-primary font-semibold">{F.conflictTitle}</h3>
      <p className="text-ink-secondary">{F.conflictDescription}</p>
      <table className="w-full text-left">
        <thead className="text-ink-tertiary text-xs">
          <tr>
            <th className="py-1 pr-2 font-medium">&nbsp;</th>
            <th className="py-1 pr-2 font-medium">{F.conflictMine}</th>
            <th className="py-1 font-medium">{F.conflictTheirs}</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map(({ field, mine, theirs }) => (
            <tr key={field} className="border-border-default border-t">
              <th scope="row" className="text-ink-secondary py-1 pr-2 font-medium">
                {L.field[field]}
              </th>
              <td className="py-1 pr-2 tabular-nums">{display(field, mine)}</td>
              <td className="py-1 tabular-nums">{display(field, theirs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onKeep}>
          {F.keepMine}
        </Button>
        <Button type="button" size="sm" onClick={onReload}>
          {F.reloadLatest}
        </Button>
      </div>
    </section>
  );
}
