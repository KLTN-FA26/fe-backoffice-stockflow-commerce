"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Truck } from "lucide-react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { allowedLoadActions, hasManifestView, loadGateState } from "@/features/shipping/lifecycle";
import { useLoadPolling } from "@/features/shipping/queries";
import { reconcileLoad } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/BackLink";

import { RejectedScansNotice } from "./loading/RejectedScans";
import { HandoverDialog } from "./manifest/HandoverDialog";
import { ManifestDocument } from "./manifest/ManifestDocument";
import { RefetchErrorNotice } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const L = UI_LABELS.shipping;
const M = L.manifest;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

function ManifestBody({ id }: { id: string }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useLoadPolling(id, { enabled: canRead });
  const [handoverOpen, setHandoverOpen] = useState(false);
  useBreadcrumbLabel(id, query.data?.number);

  if (!canRead) return <ShippingLoadError error={null} kind="no-read" />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused") {
      return <ShippingLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }
  const load = query.data;
  if (!load) {
    return <ShippingLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  // Chuyến chưa xếp hàng / đã huỷ không có biên bản (vào thẳng URL) — không in tài liệu rỗng
  if (!hasManifestView(load.status)) {
    return (
      <EmptyState
        title={M.unavailableTitle}
        description={M.unavailableDescription}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.shipments.loading(load.loadId)}>{L.loadingTitle}</Link>
          </Button>
        }
      />
    );
  }
  const handover = allowedLoadActions(loadGateState(load), can).find(
    ({ action }) => action.code === "handover",
  );
  // Thao tác bàn giao không còn hợp lệ (máy khác đã bàn giao, thiếu kiện sau khi tải lại) → đóng dialog
  const canHandover = !!handover && !handover.disabledReason;
  // …và quên luôn ý định mở: nếu không, khi chuyến đủ kiện lại (tải lại ngầm) dialog tự bật lên
  if (handoverOpen && !canHandover) setHandoverOpen(false);
  const { missingLines, planned, loaded } = reconcileLoad(load);
  // Biên bản để ký chỉ in khi đủ kiện (hoặc đã bàn giao) — tránh hai bên ký tờ lệch với thực tế
  const printBlocked = !load.manifest && (planned === 0 || missingLines.length > 0);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`${L.manifestTitle} · ${load.number}`}
          subtitle={L.manifest.reconcileTitle}
          actions={
            <>
              <BackLink href={ADMIN_ROUTES.shipments.loading(load.loadId)} label={L.loadingTitle} />
              <Button
                variant="outline"
                size="sm"
                disabled={printBlocked}
                title={printBlocked ? M.printBlocked : undefined}
                onClick={() => window.print()}
              >
                <Printer className="size-3.5" /> {L.action.print}
              </Button>
              {handover && (
                <Button
                  size="sm"
                  className={PRIMARY}
                  disabled={!!handover.disabledReason}
                  onClick={() => setHandoverOpen(true)}
                >
                  <Truck className="size-3.5" /> {L.action.handover}
                </Button>
              )}
            </>
          }
        />
        <div className="mb-4 space-y-2">
          {load.manifest ? (
            <Alert tone="info" title={L.noActions.dispatched}>
              {`${load.manifest.manifestNumber} · ${loaded}/${planned} ${M.packagesUnit}`}
            </Alert>
          ) : planned === 0 ? (
            <Alert tone="warning">{L.disabledReason.emptyLoad}</Alert>
          ) : missingLines.length > 0 ? (
            <Alert
              tone="danger"
              title={`${M.missingPrefix} ${missingLines.length} ${M.packagesUnit} (${loaded}/${planned})`}
            >
              {L.missingHint} {M.printBlocked}
            </Alert>
          ) : (
            <Alert
              tone="info"
              title={`${M.completePrefix} ${loaded}/${planned} ${M.packagesUnit} ${M.completeSuffix}`}
            >
              {M.completeHint}
            </Alert>
          )}
          {!load.manifest && <RejectedScansNotice load={load} />}
          <p className="text-ink-tertiary text-xs">{L.noTracking}</p>
        </div>
      </div>
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <ManifestDocument load={load} />
      {handoverOpen && canHandover && (
        <HandoverDialog load={load} onClose={() => setHandoverOpen(false)} />
      )}
    </>
  );
}

/** Đối soát + biên bản bàn giao (SCRUM-288 bước 2–3): in để hai bên ký, rồi xác nhận bàn giao. */
export function ManifestScreen({ id }: { id: string }) {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]}>
      <ManifestBody id={id} />
    </ShippingPermissionGate>
  );
}
