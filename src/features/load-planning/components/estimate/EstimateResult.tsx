"use client";

import { useMemo, useState } from "react";

import { LOAD_ESTIMATE_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import { isBudgetExhausted, summarizeEstimate } from "../../lib/estimate-view";
import { computeKitBalance } from "../../lib/kit-balance";
import { colorMapForLayouts } from "../../lib/palette";
import { KitBalanceBadge } from "../report/KitBalanceBadge";
import { LayoutMetrics } from "../report/LayoutMetrics";
import { VehicleViewer } from "../viewer/VehicleViewer";

import { EstimateLinesTable } from "./EstimateLinesTable";
import { EstimateUnplacedTable } from "./EstimateUnplacedTable";
import { EstimateWarnings } from "./EstimateWarnings";
import { IncompleteBanner } from "./IncompleteBanner";
import { VehicleSwitcher } from "./VehicleSwitcher";

import type { LoadEstimate } from "../../estimate-types";

/**
 * Kết quả một ước tính: cảnh báo thiếu dữ liệu (LP2-3), "Dừng do hết thời gian tính" (LP2-10), số liệu, khung 3D từng xe
 * (đổi xe bằng `VehicleSwitcher`), bảng dòng, kiện chưa xếp và cảnh báo. Mỗi xe một màu theo mặt hàng, chung cho mọi xe.
 */
export function EstimateResult({ estimate }: { estimate: LoadEstimate }) {
  const L = LOAD_ESTIMATE_LABELS.result;
  const [pickedSeq, setPickedSeq] = useState<number | null>(null);
  const colorMap = useMemo(() => colorMapForLayouts(estimate.vehicles), [estimate.vehicles]);
  const kitBalance = useMemo(() => computeKitBalance(estimate.vehicles), [estimate.vehicles]);
  // Ước tính mới có thể ít xe hơn xe đang xem: rơi về xe đầu thay vì để trống
  const vehicle = estimate.vehicles.find((v) => v.seq === pickedSeq) ?? estimate.vehicles[0];

  return (
    <div className="space-y-4">
      <IncompleteBanner missing={estimate.missing} />
      {isBudgetExhausted(estimate) && (
        <Alert tone="info" title={L.budgetExhausted}>
          {L.budgetExhaustedHint}
        </Alert>
      )}
      <LayoutMetrics summary={summarizeEstimate(estimate)} />
      {vehicle ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <VehicleSwitcher
              vehicles={estimate.vehicles}
              selectedSeq={vehicle.seq}
              onSelect={setPickedSeq}
            />
            <KitBalanceBadge balance={kitBalance} />
          </div>
          <VehicleViewer layout={vehicle} colorMap={colorMap} />
        </div>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noVehicles}</p>
      )}
      <EstimateLinesTable lines={estimate.lines} />
      <EstimateUnplacedTable unplaced={estimate.unplaced} />
      <EstimateWarnings warnings={estimate.warnings} kitWarnings={estimate.meta.kitWarnings} />
    </div>
  );
}
