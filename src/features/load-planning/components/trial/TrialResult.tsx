"use client";

import { useMemo, useState } from "react";

import { LOAD_ESTIMATE_LABELS, TRIAL_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";

import { isBudgetExhausted, summarizeEstimate } from "../../lib/estimate-view";
import { colorMapForLayouts } from "../../lib/palette";
import { EstimateUnplacedTable } from "../estimate/EstimateUnplacedTable";
import { VehicleSwitcher } from "../estimate/VehicleSwitcher";
import { LayoutMetrics } from "../report/LayoutMetrics";
import { VehicleViewer } from "../viewer/VehicleViewer";

import type { TrialEstimate } from "../../trial/trial-types";

/**
 * Kết quả chạy thử trong khung 3D có sẵn của ước tính (cùng `VehicleViewer`, số liệu, bảng kiện chưa xếp). Huy hiệu
 * "Chạy thử — không lưu" luôn hiện: kết quả này không lưu và không lấy lại được. Không hiện ô khối lượng (file không có).
 */
export function TrialResult({ estimate }: { estimate: TrialEstimate }) {
  const L = TRIAL_LABELS.result;
  const R = LOAD_ESTIMATE_LABELS.result;
  const [pickedSeq, setPickedSeq] = useState<number | null>(null);
  const colorMap = useMemo(() => colorMapForLayouts(estimate.vehicles), [estimate.vehicles]);
  const vehicle = estimate.vehicles.find((v) => v.seq === pickedSeq) ?? estimate.vehicles[0];

  return (
    <section aria-label={L.title} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">{L.title}</h2>
        <Badge variant="outline">{TRIAL_LABELS.badge}</Badge>
      </div>
      <p className="text-ink-secondary text-[0.8125rem]">{L.hint}</p>
      {isBudgetExhausted(estimate) && (
        <Alert tone="info" title={R.budgetExhausted}>
          {R.budgetExhaustedHint}
        </Alert>
      )}
      <LayoutMetrics summary={summarizeEstimate(estimate)} hideWeight />
      {vehicle ? (
        <div className="space-y-2">
          <VehicleSwitcher
            vehicles={estimate.vehicles}
            selectedSeq={vehicle.seq}
            onSelect={setPickedSeq}
          />
          <VehicleViewer layout={vehicle} colorMap={colorMap} />
        </div>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{R.noVehicles}</p>
      )}
      <EstimateUnplacedTable unplaced={estimate.unplaced} />
    </section>
  );
}
