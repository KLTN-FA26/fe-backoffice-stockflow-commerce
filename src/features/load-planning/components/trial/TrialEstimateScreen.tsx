"use client";

import { LOAD_ESTIMATE_PERMISSIONS, TRIAL_LABELS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/shared/Card";

import { useTrialScreen } from "../../trial/use-trial-screen";
import { EstimateControls } from "../estimate/EstimateControls";

import { TrialPreview } from "./TrialPreview";
import { TrialResult } from "./TrialResult";
import { TrialUpload } from "./TrialUpload";

const L = TRIAL_LABELS;

function TrialContent() {
  const s = useTrialScreen(true);
  return (
    // Trang dạng form (`surface-soft surface-compact`): tên trang nằm ở breadcrumb, h1 chỉ cho trình đọc màn hình
    <div className="surface-soft surface-compact space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sr-only">{L.pageTitle}</h1>
        <Badge variant="outline">{L.badge}</Badge>
        <p className="text-ink-secondary text-[0.8125rem]">{L.intro}</p>
      </div>
      <Card className="space-y-6">
        <TrialUpload
          onPick={(file) => void s.pick(file)}
          reading={s.reading}
          fileName={s.file?.name ?? null}
          error={s.fileError}
        />
        {s.file && <TrialPreview parsed={s.file.parsed} overCap={s.overCap} />}
        {s.file && (
          <div className="space-y-2">
            <h2 className="text-ink-primary text-sm font-semibold">{L.run.title}</h2>
            <EstimateControls
              vehicleTypes={s.vehicleTypes.data}
              vehicleTypesState={
                s.vehicleTypes.isError ? "error" : s.vehicleTypes.isPending ? "loading" : "ready"
              }
              onRetryVehicleTypes={() => void s.vehicleTypes.refetch()}
              selectedIds={s.selectedIds}
              onSelectedChange={s.setSelectedIds}
              mode={s.mode}
              onModeChange={s.setMode}
              onRun={s.execute}
              isPending={s.running}
              blockedReason={s.overCap ? L.run.blockedOverCap : null}
              hasResult={s.result !== null}
              runLabels={L.run}
            />
          </div>
        )}
        {s.runError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {s.runError}
          </p>
        )}
      </Card>
      {s.result && (
        <Card>
          <TrialResult estimate={s.result} />
        </Card>
      )}
    </div>
  );
}

/**
 * "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9): file Excel EasyCargo → xem trước → chạy thử xếp xe, không lưu gì. Vào
 * trang cần `fulfillment-load-estimates:CREATE` (đúng quyền của BE; UI-only — Backend phải re-check).
 */
export function TrialEstimateScreen() {
  return (
    <PermissionBoundary permissions={[LOAD_ESTIMATE_PERMISSIONS.create]} variant="detail">
      <TrialContent />
    </PermissionBoundary>
  );
}
