"use client";

import { AREA_TYPE_LABELS, STORAGE_CLASS_LABELS, UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { boxOf } from "@/features/warehouse-map/selectors";

import { StatusDot } from "@/components/shared/StatusDot";
import { MapDialog } from "../shared/MapDialog";
import { ShelfLevelsGrid } from "./ShelfLevelsGrid";

import type { ReactNode } from "react";
import type { Footprint, LayoutArea, LayoutShelf, Zone } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;
const P = L.panel;

const footprintText = (f: Footprint) => {
  const b = boxOf(f);
  return `(${formatNumber(b.x)}, ${formatNumber(b.y)}) · ${formatNumber(f.width)} × ${formatNumber(f.length)} m · ${f.rotation}°`;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="text-ink-primary min-w-0">{children}</dd>
    </div>
  );
}

const mono = (text: string) => <span className="font-[family-name:var(--font-mono)]">{text}</span>;

/**
 * Modal chi tiết kệ / khu vực vừa bấm trên bản đồ: trạng thái, vị trí, zone, tầng × bin.
 * `statusAction` = nút đổi trạng thái — chỉ có khi được phép (`placeStatusTargets`).
 */
export function PlaceDetailDialog({
  place,
  zones,
  statusAction,
  onClose,
}: {
  place: { kind: "shelf"; shelf: LayoutShelf } | { kind: "area"; area: LayoutArea };
  zones: readonly Zone[];
  statusAction?: ReactNode;
  onClose: () => void;
}) {
  const item = place.kind === "shelf" ? place.shelf : place.area;
  return (
    <MapDialog
      open
      onClose={onClose}
      eyebrow={place.kind === "shelf" ? P.shelf : AREA_TYPE_LABELS[place.area.type]}
      title={
        <>
          {mono(item.code)} · {item.name}
        </>
      }
      closeLabel={P.close}
    >
      <dl className="space-y-1.5">
        <Row label={P.status}>
          <StatusDot domain="location" status={item.status} />
        </Row>
        <Row label={P.effectiveStatus}>
          <StatusDot domain="location" status={item.effectiveStatus} />
        </Row>
        <Row label={P.footprint}>{footprintText(item.footprint)}</Row>
        {place.kind === "shelf" ? (
          <>
            <Row label={P.zone}>
              {zones.find((zone) => zone.id === place.shelf.zoneId)?.name ?? P.noZone}
            </Row>
            <Row label={P.storageClass}>
              {STORAGE_CLASS_LABELS[place.shelf.defaultStorageClass]}
            </Row>
            <Row label={P.pickFaces}>
              {(["north", "east", "south", "west"] as const)
                .filter((face) => place.shelf.pickFaces[face])
                .map((face) => L.faces[face])
                .join(", ") || P.noPickFace}
            </Row>
          </>
        ) : (
          <>
            <Row label={P.locationCode}>
              {place.area.locationCode ? mono(place.area.locationCode) : P.nonStorage}
            </Row>
            {place.area.storageClass && (
              <Row label={P.storageClass}>{STORAGE_CLASS_LABELS[place.area.storageClass]}</Row>
            )}
          </>
        )}
      </dl>
      {statusAction}
      {place.kind === "shelf" && (
        <div className="space-y-1.5">
          <h3 className="text-ink-secondary text-xs font-medium">{P.levels}</h3>
          <ShelfLevelsGrid shelf={place.shelf} />
        </div>
      )}
    </MapDialog>
  );
}
