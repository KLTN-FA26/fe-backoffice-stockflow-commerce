"use client";

import { useMemo, useState } from "react";
import { Loader2, Printer, Truck } from "lucide-react";

import {
  ADMIN_ROUTES,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_PRINT_LABELS,
  SHIPMENT_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { Alert } from "@/components/shared/Alert";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useLoadBooking } from "../../print-booking";
import { colorMapForPrint } from "../../lib/palette";
import { buildPrintSheet } from "../../lib/print-sheet";
import { useLoadPlan, useLoadPlanLayouts } from "../../queries";
import { DetailLoadError } from "../detail/DetailLoadError";
import { LoadSheetDocument } from "./LoadSheetDocument";
import { usePrintImages } from "./usePrintImages";

const L = LOAD_PLAN_PRINT_LABELS;

/** Tiến độ dựng ảnh 3D; lỗi (thường là không có WebGL) cho thử lại hoặc xem phiếu không ảnh. */
function CaptureStatus({
  state,
  onRetry,
  onSkip,
}: {
  state: ReturnType<typeof usePrintImages>["state"];
  onRetry: () => void;
  onSkip: () => void;
}) {
  if (state.status === "error") {
    return (
      <Alert tone="danger" title={L.captureFailed}>
        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {L.retry}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSkip}>
            {L.printWithoutImages}
          </Button>
        </div>
      </Alert>
    );
  }
  if (state.status !== "capturing") return null;
  return (
    <div role="status" className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-4">
      <p className="text-ink-primary flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {L.capturing(state.done, state.total)}
      </p>
      <progress
        className="h-2 w-full"
        max={state.total}
        value={state.done}
        aria-label={L.capturing(state.done, state.total)}
      />
      <p className="text-ink-tertiary text-xs">{L.capturingHint}</p>
    </div>
  );
}

/** Xe không có trong kế hoạch (hoặc số xe trong URL sai): báo rõ và dẫn về chi tiết kế hoạch. */
function VehicleMissing({ id, message }: { id: string; message: string }) {
  return (
    <EmptyState
      icon={<Truck className="size-8" />}
      title={message}
      action={<BackLink href={ADMIN_ROUTES.loadPlans.detail(id)} label={L.back} />}
    />
  );
}

function PrintBody({ id, seq }: { id: string; seq: number }) {
  const plan = useLoadPlan(id, { enabled: true });
  const layouts = useLoadPlanLayouts(id, true);
  const colorMap = useMemo(() => colorMapForPrint(layouts.data ?? []), [layouts.data]);
  const sheet = useMemo(
    () => (plan.data && layouts.data ? buildPrintSheet(plan.data, layouts.data, seq) : null),
    [plan.data, layouts.data, seq],
  );
  const canReadLoads = useCan(SHIPMENT_PERMISSIONS.read);
  const booking = useLoadBooking(sheet?.vehicle.load?.loadId, canReadLoads);
  const { state, retry } = usePrintImages(sheet?.layout, layouts.data, colorMap);
  const [skipImages, setSkipImages] = useState(false);
  const [printedAt] = useState(() => new Date().toISOString());
  useBreadcrumbLabel(id, plan.data?.code);

  if (plan.isPending || (layouts.isPending && !layouts.isError))
    return <PageSkeleton variant="detail" />;
  if (!plan.data) return <DetailLoadError error={plan.error} onRetry={() => void plan.refetch()} />;
  if (layouts.isError)
    return <DetailLoadError error={layouts.error} onRetry={() => void layouts.refetch()} />;
  if (!sheet) return <VehicleMissing id={id} message={L.vehicleNotFound} />;

  const ready = state.status === "ready" || skipImages;
  const images = state.status === "ready" && !skipImages ? state.images : null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <BackLink href={ADMIN_ROUTES.loadPlans.detail(id)} label={L.back} />
        <Button type="button" size="sm" disabled={!ready} onClick={() => window.print()}>
          <Printer className="size-3.5" /> {L.printButton}
        </Button>
        <p className="text-ink-tertiary text-xs">{L.printHint}</p>
      </div>
      {!ready && (
        <div className="print:hidden">
          <CaptureStatus state={state} onRetry={retry} onSkip={() => setSkipImages(true)} />
        </div>
      )}
      {ready && (
        <LoadSheetDocument
          planCode={plan.data.code}
          sheet={sheet}
          images={images}
          booking={booking.data}
          colorMap={colorMap}
          printedAt={printedAt}
        />
      )}
    </>
  );
}

/**
 * Phiếu xếp hàng in được của một xe trong kế hoạch (SCRUM-287 PR F6, LP-10): trang HTML dựng từ API bố cục, in bằng
 * hộp thoại của trình duyệt (không xuất PDF trong ứng dụng). Cần `fulfillment-load-plans:READ`; ô hãng / biển số / tài xế chỉ
 * có khi xe đã thành chuyến và người xem có `fulfillment-shipments:READ` — UI-only, Backend phải re-check.
 */
export function LoadSheetPrint({ id, seq }: { id: string; seq: number }) {
  return (
    <PermissionBoundary permissions={[LOAD_PLAN_PERMISSIONS.read]} variant="detail">
      <div className="surface-soft surface-compact space-y-4">
        <h1 className="sr-only">{L.documentTitle}</h1>
        {Number.isInteger(seq) && seq >= 1 ? (
          <PrintBody id={id} seq={seq} />
        ) : (
          <VehicleMissing id={id} message={L.badSeq} />
        )}
      </div>
    </PermissionBoundary>
  );
}
