"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

import { UI_LABELS, WAREHOUSE_LOCATION_PERMISSIONS, WAREHOUSE_STATUS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan, usePermissionChecker } from "@/lib/auth";

import { placeStatusTargets, warehouseMapActions } from "@/features/warehouse-map/lifecycle";
import { useWarehouseLayout } from "@/features/warehouse-map/queries";
import { findPlace, isLayoutEmpty } from "@/features/warehouse-map/selectors";

import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";

import { MapEditors } from "./editor/MapEditors";
import { MapLayoutError } from "./MapLayoutError";
import { MapLegend } from "./MapLegend";
import { MapToolbar } from "./MapToolbar";
import { MapCanvas2D } from "./MapCanvas2D";
import { MapViewer3D } from "./MapViewer3D";
import { PlaceDetailPanel } from "./PlaceDetailPanel";
import { PlaceStatusControl } from "./PlaceStatusControl";
import { useMapUrlState } from "./useMapUrlState";

import type { EditorKind } from "./MapToolbar";

const M = UI_LABELS.warehouseMap.map;

function WarehouseMapContent() {
  const url = useMapUrlState();
  const can = usePermissionChecker();
  const canRead = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const actions = warehouseMapActions({ can });
  const [editor, setEditor] = useState<EditorKind | null>(null);
  const layout = useWarehouseLayout(url.warehouseId, canRead);
  const data = layout.data;
  const place = data ? findPlace(data, url.selectedId) : null;
  const status = place ? (place.kind === "shelf" ? place.shelf : place.area) : null;
  const targets = status ? placeStatusTargets(status.status, { can }) : [];

  const body = () => {
    if (!canRead) return <EmptyState title={M.loadFailedTitle} description={M.noReadDescription} />;
    if (!url.warehouseId)
      return (
        <EmptyState
          icon={<MapPin className="size-8" />}
          title={M.noWarehouseTitle}
          description={M.noWarehouseDescription}
        />
      );
    if (layout.isError && !data)
      return <MapLayoutError error={layout.error} onRetry={() => void layout.refetch()} />;
    if (!data)
      return (
        <div
          role="status"
          aria-label={M.loading3d}
          className="bg-bg-muted h-96 animate-pulse rounded-(--card-radius)"
        />
      );
    const viewer = { layout: data, selectedId: url.selectedId, onSelect: url.select };
    return (
      <>
        <MapLegend layout={data} />
        {data.warehouse.status === WAREHOUSE_STATUS.INACTIVE && (
          <Alert tone="warning">{M.inactiveWarehouse}</Alert>
        )}
        {isLayoutEmpty(data) && <Alert tone="info">{M.emptyLayout}</Alert>}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="border-border-default bg-bg-surface min-w-0 rounded-(--card-radius) border p-2 shadow-(--card-shadow)">
            {url.view === "3d" ? <MapViewer3D {...viewer} /> : <MapCanvas2D {...viewer} />}
          </div>
          <aside className="min-w-0">
            {place ? (
              <PlaceDetailPanel
                key={url.selectedId}
                place={place}
                zones={data.zones}
                onClose={() => url.select(null)}
                statusAction={
                  targets.length > 0 && status ? (
                    <PlaceStatusControl kind={place.kind} id={status.id} targets={targets} />
                  ) : undefined
                }
              />
            ) : (
              <p className="text-ink-tertiary border-border-default rounded-(--card-radius) border border-dashed p-4 text-xs">
                {UI_LABELS.warehouseMap.panel.empty}
              </p>
            )}
          </aside>
        </div>
        <p className="text-ink-tertiary text-xs">{M.disclaimer}</p>
        {editor && <MapEditors kind={editor} layout={data} onClose={() => setEditor(null)} />}
      </>
    );
  };

  return (
    // Loại trang Chi tiết (`surface-soft surface-compact`): không title hiển thị, tên ở breadcrumb
    <div className="surface-soft surface-compact space-y-3">
      <h1 className="sr-only">{M.canvasLabel(data?.warehouse.name ?? "")}</h1>
      {canRead && (
        <MapToolbar url={url} canEdit={actions.editLayout && Boolean(data)} onEdit={setEditor} />
      )}
      {body()}
    </div>
  );
}

/**
 * Bản đồ kho 2D / 3D (docs 06 §1, §4): chọn kho, xem mặt bằng hoặc 3D theo cao độ tầng, chọn kệ / khu
 * vực để xem tầng × bin và đổi trạng thái; Quản lý kho vẽ thêm zone / kệ / khu vực / tường-cửa. Trang
 * cần `warehouse-locations:VIEW_PAGE`, dữ liệu cần `:READ` (UI-only — Backend phải re-check).
 */
export function WarehouseMapView() {
  return (
    <PermissionBoundary permissions={[WAREHOUSE_LOCATION_PERMISSIONS.viewPage]} variant="detail">
      <WarehouseMapContent />
    </PermissionBoundary>
  );
}
