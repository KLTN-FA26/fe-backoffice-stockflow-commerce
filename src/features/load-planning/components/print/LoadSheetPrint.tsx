"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import {
  ADMIN_ROUTES,
  LOAD_PLAN_PERMISSIONS,
  LOAD_PLAN_PRINT_LABELS,
  SHIPMENT_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { BackLink } from "@/components/shared/BackLink";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useLoadBooking } from "../../print-booking";
import { colorMapForPrint } from "../../lib/palette";
import { bookingNeedsFetch, bookingViewOf, bookingSettled } from "../../lib/booking-view";
import { buildPrintSheet } from "../../lib/print-sheet";
import { useLoadPlan, useLoadPlanLayouts } from "../../queries";
import { DetailLoadError } from "../detail/DetailLoadError";
import { CaptureStatus } from "./CaptureStatus";
import { LoadSheetDocument } from "./LoadSheetDocument";
import { usePrintImages } from "./usePrintImages";
import { VehicleMissing } from "./VehicleMissing";

const L = LOAD_PLAN_PRINT_LABELS;

function PrintBody({ id, seq }: { id: string; seq: number }) {
  const plan = useLoadPlan(id, { enabled: true });
  const layouts = useLoadPlanLayouts(id, true);
  const colorMap = useMemo(() => colorMapForPrint(layouts.data ?? []), [layouts.data]);
  const sheet = useMemo(
    () => (plan.data && layouts.data ? buildPrintSheet(plan.data, layouts.data, seq) : null),
    [plan.data, layouts.data, seq],
  );
  const canReadLoads = useCan(SHIPMENT_PERMISSIONS.read);
  const load = sheet?.vehicle.load;
  const booking = useLoadBooking(load?.loadId, bookingNeedsFetch(load, canReadLoads));
  const bookingView = bookingViewOf({
    load,
    canReadLoads,
    data: booking.data,
    isError: booking.isError,
  });
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
        <Button
          type="button"
          size="sm"
          disabled={!ready || !bookingSettled(bookingView)}
          onClick={() => window.print()}
        >
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
          booking={bookingView}
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
