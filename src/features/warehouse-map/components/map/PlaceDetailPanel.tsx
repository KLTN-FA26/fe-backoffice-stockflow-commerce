"use client";

import { X } from "lucide-react";

import { AREA_TYPE_LABELS, STORAGE_CLASS_LABELS, UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";

import { boxOf } from "@/features/warehouse-map/selectors";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

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
 * Panel chi tiết kệ / khu vực đang chọn (loại trang Chi tiết: tên nằm ở "Thông tin chung", không
 * title trang). `statusAction` = nút đổi trạng thái — chỉ có khi được phép (`placeStatusTargets`).
 */
export function PlaceDetailPanel({
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
    <section
      aria-label={P.title}
      className="border-border-default bg-bg-surface space-y-3 rounded-(--card-radius) border p-3 shadow-(--card-shadow)"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink-tertiary text-[0.6875rem]">
            {place.kind === "shelf" ? P.shelf : AREA_TYPE_LABELS[place.area.type]}
          </p>
          <h2 className="text-ink-primary truncate text-sm font-semibold">
            {mono(item.code)} · {item.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={P.close}
          onClick={onClose}
          className="text-ink-tertiary size-7"
        >
          <X className="size-3.5" />
        </Button>
      </header>
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
    </section>
  );
}
