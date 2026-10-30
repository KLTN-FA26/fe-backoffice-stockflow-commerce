"use client";

import { useState } from "react";

import { UI_LABELS, WAREHOUSE_LOCATION_PERMISSIONS, WAREHOUSE_STATUS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan, usePermissionChecker } from "@/lib/auth";

import { placeStatusTargets, warehouseMapActions } from "@/features/warehouse-map/lifecycle";
import { useWarehouseLayout } from "@/features/warehouse-map/queries";
import {
  findPlace,
  inactiveCount,
  isLayoutEmpty,
  withoutInactive,
} from "@/features/warehouse-map/selectors";

import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";

import { MapEditMode } from "../editor/MapEditMode";
import { MapFrame } from "../shared/MapFrame";
import { useHotkeys } from "../shared/use-hotkeys";
import { MAP_PAGE_CLASS } from "../shared/use-map-fullscreen";
import { WarehouseScope } from "../workspace/WarehouseScope";
import { MapLayoutError } from "./MapLayoutError";
import { MapToolbar } from "./MapToolbar";
import { MapCanvas2D } from "./MapCanvas2D";
import { MapViewer3D } from "./MapViewer3D";
import { PlaceDetailDialog } from "./PlaceDetailDialog";
import { PlaceStatusControl } from "./PlaceStatusControl";
import { useMapUrlState } from "./useMapUrlState";

import type { Warehouse } from "@/features/warehouse-map/types";

const M = UI_LABELS.warehouseMap.map;

function WarehouseMapContent({ warehouse }: { warehouse: Warehouse }) {
  const url = useMapUrlState();
  const can = usePermissionChecker();
  const canRead = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const actions = warehouseMapActions({ can });
  const [editing, setEditing] = useState(false);
  // 3D: bấm kệ chỉ bay camera tới + thẻ hàng; modal chi tiết mở bằng nút trên thẻ
  const in3d = url.view === "3d";
  const [detailId, setDetailId] = useState<string | null>(null);
  const layout = useWarehouseLayout(warehouse.id, canRead);
  const data = layout.data;
  const place = data ? findPlace(data, url.selectedId) : null;
  const status = place ? (place.kind === "shelf" ? place.shelf : place.area) : null;
  const targets = status ? placeStatusTargets(status.status, { can }) : [];
  const canEdit = actions.editLayout && Boolean(data);
  const startEditing = () => {
    url.select(null);
    setEditing(true);
  };
  // Phím tắt chế độ xem (bảng: WAREHOUSE_MAP_SHORTCUTS.view); chế độ sửa có bộ phím riêng
  useHotkeys(
    {
      "2": () => url.setView("2d"),
      "3": () => url.setView("3d"),
      e: () => canEdit && startEditing(),
    },
    { enabled: !editing && canRead },
  );

  const toolbar = canRead && (
    <MapToolbar
      url={url}
      canEdit={canEdit}
      onEdit={startEditing}
      inactive={data ? inactiveCount(data) : 0}
    />
  );

  const body = () => {
    if (!canRead) return <EmptyState title={M.loadFailedTitle} description={M.noReadDescription} />;
    if (layout.isError && !data)
      return <MapLayoutError error={layout.error} onRetry={() => void layout.refetch()} />;
    if (!data)
      return (
        <div
          role="status"
          aria-label={M.loading3d}
          className="bg-bg-muted min-h-0 flex-1 animate-pulse rounded-(--card-radius)"
        />
      );
    // Vị trí ngừng dùng mặc định ẩn (không giữ chỗ — BR-07 — nên vẽ ra sẽ chồng hình đang dùng)
    const shown = url.showInactive ? data : withoutInactive(data);
    const viewer = { layout: shown, selectedId: url.selectedId, onSelect: url.select };
    return (
      <>
        {/* Thanh công cụ + cảnh báo đi theo khung: toàn màn hình thì vào trong khung, không bị che */}
        <MapFrame
          layout={withoutInactive(data)}
          toolbar={
            <>
              {toolbar}
              {data.warehouse.status === WAREHOUSE_STATUS.INACTIVE && (
                <Alert tone="warning">{M.inactiveWarehouse}</Alert>
              )}
              {isLayoutEmpty(data) && <Alert tone="info">{M.emptyLayout}</Alert>}
            </>
          }
        >
          {(controls) =>
            url.view === "3d" ? (
              <MapViewer3D
                {...viewer}
                controls={controls}
                onOpenDetail={() => setDetailId(url.selectedId)}
              />
            ) : (
              <MapCanvas2D {...viewer} controls={controls} />
            )
          }
        </MapFrame>
        {place && (!in3d || detailId === url.selectedId) && (
          <PlaceDetailDialog
            key={url.selectedId}
            place={place}
            zones={data.zones}
            onClose={() => (in3d ? setDetailId(null) : url.select(null))}
            statusAction={
              targets.length > 0 && status ? (
                <PlaceStatusControl kind={place.kind} id={status.id} targets={targets} />
              ) : undefined
            }
          />
        )}
      </>
    );
  };

  return (
    // Loại trang Chi tiết (`surface-soft surface-compact`): không title hiển thị, tên ở breadcrumb
    <div className={MAP_PAGE_CLASS}>
      <h1 className="sr-only">{M.canvasLabel(data?.warehouse.name ?? "")}</h1>
      {editing && data ? (
        <MapEditMode
          key={data.warehouse.id}
          layout={data}
          can={{ update: actions.updateLayout, delete: actions.deleteBoundary }}
          onExit={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Chưa có bố cục (đang tải / lỗi) thì thanh công cụ đứng riêng; có rồi thì MapFrame đặt nó */}
          {!data && toolbar}
          {body()}
        </>
      )}
    </div>
  );
}

/**
 * Bản đồ kho 2D / 3D (docs 06 §1, §4) của kho có prefix trên URL, xem mặt bằng hoặc 3D theo cao độ tầng, chọn kệ / khu
 * vực để xem tầng × bin và đổi trạng thái; Quản lý kho vào chế độ sửa để vẽ / dời / xoá rồi lưu một lần. Trang
 * cần `warehouse-locations:VIEW_PAGE`, dữ liệu cần `:READ` (UI-only — Backend phải re-check).
 */
export function WarehouseMapView({ prefix }: { prefix: string }) {
  return (
    <PermissionBoundary permissions={[WAREHOUSE_LOCATION_PERMISSIONS.viewPage]} variant="detail">
      <div className="surface-soft surface-compact">
        {/* Kho lấy từ prefix trên URL — key theo kho để đổi kho là dựng lại trang (bỏ bản nháp cũ) */}
        <WarehouseScope prefix={prefix}>
          {(warehouse) => <WarehouseMapContent key={warehouse.id} warehouse={warehouse} />}
        </WarehouseScope>
      </div>
    </PermissionBoundary>
  );
}
