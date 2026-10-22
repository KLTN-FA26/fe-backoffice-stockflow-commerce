"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

import { ADMIN_ROUTES, LOAD_PLAN_PRINT_LABELS, LOAD_PLANNING_LABELS, UI_LABELS } from "@/constants";
import { formatNumber, formatPercent } from "@/lib/format";
import { VehicleViewer } from "../viewer/VehicleViewer";
import { Button } from "@/components/ui/button";

import { ColorLegend } from "./ColorLegend";

import type { ColorMap } from "@/features/load-planning/lib/palette";
import type { PlanVehicle } from "@/features/load-planning/plan-types";
import type { Layout } from "@/features/load-planning/types";

const L = UI_LABELS.loadPlan.detail;

/**
 * Một xe: số liệu, khung 3D, chú giải màu, nút tính lại riêng xe (cần `:UPDATE` và kế hoạch PLANNED). Xe cần tính lại
 * (`needsRecalculation`) có huy hiệu ở bộ chọn xe và thông báo đầu trang — BE từ chối chốt cho tới khi tính lại.
 */
export function VehiclePanel({
  planId,
  vehicle,
  layout,
  colorMap,
  canRecalculate,
  pending,
  onRecalculate,
}: {
  planId: string;
  vehicle: PlanVehicle;
  layout: Layout | undefined;
  colorMap: ColorMap;
  canRecalculate: boolean;
  pending: boolean;
  onRecalculate: () => void;
}) {
  const stats: [string, string][] = [
    [L.vehicleParcels, formatNumber(vehicle.packageCount)],
    [L.vehicleFill, formatPercent(vehicle.volumeFillPct / 100, 1)],
    [L.vehicleWeightFill, formatPercent(vehicle.weightFillPct / 100, 1)],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-tertiary text-xs">{label}</dt>
              <dd className="text-ink-primary text-[0.8125rem] font-medium tabular-nums">
                {value}
              </dd>
            </div>
          ))}
          {vehicle.load && (
            <div>
              <dt className="text-ink-tertiary text-xs">{L.dispatchLoad}</dt>
              <dd className="text-ink-primary font-mono text-[0.8125rem]">{vehicle.load.code}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={ADMIN_ROUTES.loadPlans.print(planId, vehicle.seq)}>
              <Printer className="size-3.5" /> {LOAD_PLAN_PRINT_LABELS.printButton}
            </Link>
          </Button>
          {canRecalculate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onRecalculate}
            >
              {L.actions.recalculate}
            </Button>
          )}
        </div>
      </div>
      {layout ? (
        <>
          <VehicleViewer layout={layout} colorMap={colorMap} />
          <ColorLegend
            partNames={[...new Set(layout.boxes.map((box) => box.partName))].sort((a, b) =>
              a.localeCompare(b, "vi"),
            )}
            colorMap={colorMap}
          />
        </>
      ) : (
        <p className="text-ink-tertiary text-sm">{LOAD_PLANNING_LABELS.viewer.loading}</p>
      )}
    </div>
  );
}
