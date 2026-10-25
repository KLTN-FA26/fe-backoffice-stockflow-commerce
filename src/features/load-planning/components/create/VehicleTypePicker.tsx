"use client";

import { UI_LABELS, VEHICLE_TYPE_KIND_LABELS, VEHICLE_TYPE_LIMITS } from "@/constants";
import { formatFixed, formatNumber } from "@/lib/format";
import { Alert } from "@/components/shared/Alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import type { VehicleTypeOption } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.createForm;

/** Lòng xe D × R × C đổi sang mét (3 số lẻ), như danh mục loại xe. */
const innerSizeMetres = (type: VehicleTypeOption) =>
  [type.innerLengthMm, type.innerWidthMm, type.innerHeightMm]
    .map((mm) => formatFixed(mm / VEHICLE_TYPE_LIMITS.mmPerMetre, 3))
    .join(" × ");

interface VehicleTypePickerProps {
  types: readonly VehicleTypeOption[] | undefined;
  loading: boolean;
  failed: boolean;
  selected: ReadonlySet<string>;
  onToggle: (vehicleTypeId: string) => void;
}

/** Chọn loại xe đang dùng (danh mục loại xe); số xe sẵn có của loại chặn số xe tối đa của kế hoạch (BR-12, ở BE). */
export function VehicleTypePicker({
  types,
  loading,
  failed,
  selected,
  onToggle,
}: VehicleTypePickerProps) {
  if (loading) return <Skeleton className="h-16 w-full" aria-label={L.vehicleTypesTitle} />;
  if (failed) return <Alert tone="danger">{L.vehicleTypesFailed}</Alert>;
  if (!types || types.length === 0)
    return <p className="text-ink-tertiary text-sm">{L.vehicleTypesEmpty}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {types.map((type) => {
        const id = `lp-vehicle-type-${type.vehicleTypeId}`;
        return (
          <li key={type.vehicleTypeId}>
            <label
              htmlFor={id}
              className="border-border-default bg-bg-surface hover:bg-bg-subtle flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 text-[0.8125rem]"
            >
              <Checkbox
                id={id}
                aria-label={`${type.code} · ${type.name}`}
                checked={selected.has(type.vehicleTypeId)}
                onCheckedChange={() => onToggle(type.vehicleTypeId)}
              />
              <span className="min-w-0">
                <span className="text-ink-primary block font-medium">
                  <span className="font-mono">{type.code}</span> · {type.name}
                </span>
                <span className="text-ink-tertiary block text-xs">
                  {VEHICLE_TYPE_KIND_LABELS[type.kind]} · {innerSizeMetres(type)} m ·{" "}
                  {formatNumber(type.maxPayloadKg)} kg · {L.availableCount(type.availableCount)}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
