"use client";

import Link from "next/link";
import { History, Info, Map as MapIcon } from "lucide-react";

import {
  ADMIN_ROUTES,
  AREA_TYPE_LABELS,
  BIN_TYPE_LABELS,
  INVENTORY_PERMISSIONS,
  WAREHOUSE_LOCATION_LABELS as L,
} from "@/constants";
import { INVENTORY_ROUTES } from "@/constants/inventory";
import { useCan } from "@/lib/auth";
import { formatFixed, formatNumber } from "@/lib/format";

import { DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { LocationRow } from "@/features/warehouse-map/location-list-selectors";

const D = L.detail;
const H = L.column;
const NONE = "—";
/** Thể tích m³ ba số lẻ, kích thước hai số lẻ — như Bảng sức chứa (docs 06 §4.6). */
const M3_DIGITS = 3;
const M_DIGITS = 2;

const meters = (value: number | null) =>
  value === null ? NONE : `${formatFixed(value, M_DIGITS)} m`;

/** Thông tin chung của vị trí — từ layout bản đồ (docs 06), kèm link sang bản đồ và lịch sử di chuyển. */
export function LocationInfo({ row, prefix }: { row: LocationRow; prefix: string }) {
  const canSeeMovements = useCan(INVENTORY_PERMISSIONS.movementViewPage);
  const type = row.binType
    ? BIN_TYPE_LABELS[row.binType]
    : row.areaType
      ? AREA_TYPE_LABELS[row.areaType]
      : NONE;
  const uses = [row.pickable && L.pickable, row.putawayTarget && L.putawayTarget].filter(Boolean);
  return (
    <DetailSection
      title={D.general}
      icon={Info}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href={ADMIN_ROUTES.warehouseMap.place(prefix, row.placeId)}>
              <MapIcon className="size-3.5" aria-hidden /> {D.viewOnMap}
            </Link>
          </Button>
          {canSeeMovements && (
            <Button asChild size="sm" variant="outline">
              <Link href={INVENTORY_ROUTES.movementsAt(row.locationCode)}>
                <History className="size-3.5" aria-hidden /> {D.movements}
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="divide-y divide-(--table-line)">
        <InfoRow label={H.kind}>{`${L.kind[row.kind]} · ${type}`}</InfoRow>
        <InfoRow label={H.zone}>{row.zoneName ?? (row.kind === "bin" ? L.noZone : NONE)}</InfoRow>
        {row.kind === "bin" && (
          <InfoRow label={`${H.shelf} · ${H.level}`}>
            <span className="font-[family-name:var(--font-mono)]">{row.shelfCode}</span> ·{" "}
            {row.levelIndex}
          </InfoRow>
        )}
        <InfoRow label={H.status}>
          <span className="inline-flex items-center gap-2">
            <StatusDot domain="location" status={row.status} />
            {!row.usable && <span className="text-ink-tertiary text-xs">{L.notUsable}</span>}
          </span>
        </InfoRow>
        <InfoRow label={H.uses}>{uses.length > 0 ? uses.join(" · ") : NONE}</InfoRow>
        <InfoRow label={D.size}>
          {row.width === null || row.length === null
            ? NONE
            : `${meters(row.width)} × ${meters(row.length)}`}
        </InfoRow>
        {row.kind === "bin" && <InfoRow label={D.usableHeight}>{meters(row.usableHeight)}</InfoRow>}
        <InfoRow label={H.capacity}>
          {row.capacityM3 !== null
            ? formatFixed(row.capacityM3, M3_DIGITS)
            : row.kind === "area"
              ? L.noCapacity
              : NONE}
        </InfoRow>
        <InfoRow label={H.maxWeight}>
          {row.maxWeightKg === null ? NONE : formatNumber(row.maxWeightKg)}
        </InfoRow>
      </div>
    </DetailSection>
  );
}
