"use client";

import { Printer } from "lucide-react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useManifest } from "@/features/shipping/queries";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { ManifestDocument } from "./manifest/ManifestDocument";
import { RefetchErrorNotice } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const M = UI_LABELS.shipping.manifest;

function ManifestBody({ id }: { id: string }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const query = useManifest(id, canRead);
  useBreadcrumbLabel(id, query.data?.loadCode);
  const backHref = ADMIN_ROUTES.loads.detail(id);

  if (!canRead)
    return <ShippingLoadError error={null} kind="no-read" backHref={ADMIN_ROUTES.loads.list} />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused") {
      return (
        <ShippingLoadError
          error={null}
          kind="network"
          backHref={backHref}
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="detail" />;
  }
  const manifest = query.data;
  if (!manifest) {
    return (
      <ShippingLoadError
        error={query.error}
        backHref={backHref}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const dispatched = manifest.status === "DISPATCHED";
  const missing = manifest.shipments.reduce(
    (sum, shipment) => sum + shipment.packages.filter((parcel) => !parcel.loaded).length,
    0,
  );
  // Biên bản để ký chỉ in khi đủ kiện (hoặc đã bàn giao) — tránh hai bên ký tờ lệch với thực tế
  const draft = !dispatched && (manifest.packageCount === 0 || missing > 0);

  return (
    // Giao diện kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị — breadcrumb đã dẫn
    // về chuyến; gợi ý + nút in thành một hàng (ẩn khi in).
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${M.title} · ${manifest.loadCode}`}</h1>
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-secondary text-[0.8125rem]">
            {dispatched ? M.dispatchedHint : M.reconcileHint}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={draft}
            title={draft ? M.printBlocked : undefined}
            onClick={() => window.print()}
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
          >
            <Printer className="size-3.5" /> {M.print}
          </Button>
        </div>
        <div className="mb-4 space-y-2">
          {draft && (
            <Alert tone="danger" title={`${M.missingPrefix} ${missing} ${M.packagesUnit}`}>
              {M.printBlocked}
            </Alert>
          )}
          <p className="text-ink-tertiary text-xs">{UI_LABELS.shipping.noTracking}</p>
        </div>
      </div>
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <ManifestDocument manifest={manifest} draft={draft} />
    </div>
  );
}

/** Biên bản bàn giao in được (SCRUM-288): đối soát kiện, in để hai bên ký (`window.print`). */
export function ManifestScreen({ id }: { id: string }) {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]}>
      <ManifestBody id={id} />
    </ShippingPermissionGate>
  );
}
