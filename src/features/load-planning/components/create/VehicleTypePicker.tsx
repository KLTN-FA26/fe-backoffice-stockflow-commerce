"use client";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import { vehicleTypeName } from "@/lib/domain/vehicle-type-name";
import { orderVehicleTypes, vehicleTypeSize } from "@/features/load-planning/lib/vehicle-type-fit";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import type { PlanLoad } from "@/features/load-planning/lib/vehicle-type-fit";
import type { VehicleTypeOption } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.createForm;
const EMPTY_CODES: ReadonlySet<string> = new Set();

interface VehicleTypePickerProps {
  types: readonly VehicleTypeOption[] | undefined;
  loading: boolean;
  failed: boolean;
  selected: ReadonlySet<string>;
  onToggle: (vehicleTypeId: string) => void;
  /** Tải của các lô đang chọn: loại chở hết trong một xe lên đầu. */
  load?: PlanLoad;
  /** Mã loại xe mà ước tính tải của các đơn đã chọn dùng — hiện "Gợi ý". */
  recommendedCodes?: ReadonlySet<string>;
}

function TypeRow({
  type,
  checked,
  recommended,
  onToggle,
}: {
  type: VehicleTypeOption;
  checked: boolean;
  recommended: boolean;
  onToggle: () => void;
}) {
  const id = `lp-vehicle-type-${type.vehicleTypeId}`;
  const name = vehicleTypeName(type);
  return (
    <li>
      <label
        htmlFor={id}
        // Mã loại xe chỉ ở chú thích khi rê chuột (R3): người đọc thấy tên, không thấy "TRUCK-1T25"
        title={type.code}
        className="border-border-default bg-bg-surface hover:bg-bg-subtle flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 text-[0.8125rem]"
      >
        <Checkbox id={id} aria-label={name} checked={checked} onCheckedChange={onToggle} />
        <span className="min-w-0">
          <span className="text-ink-primary flex flex-wrap items-center gap-1.5 font-medium">
            {name}
            {recommended && <Badge variant="outline">{L.recommended}</Badge>}
          </span>
          <span className="text-ink-tertiary block text-xs">
            {vehicleTypeSize(type)} m · {formatNumber(type.maxPayloadKg)} kg ·{" "}
            {L.availableCount(type.availableCount)}
          </span>
        </span>
      </label>
    </li>
  );
}

/**
 * Chọn loại xe đang dùng (danh mục loại xe); số xe sẵn có của loại chặn số xe tối đa của kế hoạch (BR-12, ở BE).
 * Loại ước tính tải đã dùng và loại chở hết tải trong một xe lên đầu, nhỏ nhất trước (owner 26/11, UX-Q4) — không đưa
 * cả danh mục xếp theo mã cho tải 95 kg. Tên tiếng Việt, kích thước mét một số lẻ; mã chỉ ở chú thích.
 */
export function VehicleTypePicker({
  types,
  loading,
  failed,
  selected,
  onToggle,
  load = { weightKg: 0, volumeMm3: 0 },
  recommendedCodes = EMPTY_CODES,
}: VehicleTypePickerProps) {
  if (loading) return <Skeleton className="h-16 w-full" aria-label={L.vehicleTypesTitle} />;
  if (failed) return <Alert tone="danger">{L.vehicleTypesFailed}</Alert>;
  if (!types || types.length === 0)
    return <p className="text-ink-tertiary text-sm">{L.vehicleTypesEmpty}</p>;
  const { fitting, others } = orderVehicleTypes(types, load, recommendedCodes);
  const grid = "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3";
  const rows = (list: readonly VehicleTypeOption[]) =>
    list.map((type) => (
      <TypeRow
        key={type.vehicleTypeId}
        type={type}
        checked={selected.has(type.vehicleTypeId)}
        recommended={recommendedCodes.has(type.code)}
        onToggle={() => onToggle(type.vehicleTypeId)}
      />
    ));
  return (
    <div className="space-y-3">
      <ul className={grid}>{rows(fitting)}</ul>
      {others.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-ink-secondary text-xs font-medium">{L.vehicleTypesOthers}</p>
          <ul className={grid}>{rows(others)}</ul>
        </div>
      )}
    </div>
  );
}
