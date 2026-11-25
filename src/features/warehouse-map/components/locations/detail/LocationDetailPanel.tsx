"use client";

import { WAREHOUSE_LOCATION_LABELS as L } from "@/constants";

import { CopyButton } from "@/components/shared/CopyButton";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import { LocationCartons } from "./LocationCartons";
import { LocationContents } from "./LocationContents";
import { LocationInfo } from "./LocationInfo";

import type { LocationRow } from "@/features/warehouse-map/location-list-selectors";

/**
 * Chi tiết một vị trí: thông tin từ bản đồ (docs 06), hàng theo SKU / lô / trạng thái và thùng LPN (docs 20 §4.1).
 * `stockEnabled` false khi người xem không đọc được hàng của kho này (không được gán kho) — BE trả 403 cho vị trí
 * ở kho ngoài phạm vi, nên không gọi. Mức lấp đầy từng bin chờ BE (issue #456, cần chốt docs 06 §4.6).
 */
export function LocationDetailPanel({
  row,
  prefix,
  stockEnabled,
  onClose,
}: {
  row: LocationRow | null;
  prefix: string;
  stockEnabled: boolean;
  onClose: () => void;
}) {
  return (
    <SlideOverPanel
      open={row !== null}
      onClose={onClose}
      size="xl"
      monoTitle
      title={row?.locationCode ?? ""}
      subtitle={row ? L.kind[row.kind] : undefined}
      badge={
        row && (
          <span className="inline-flex items-center gap-2">
            <StatusDot domain="location" status={row.status} />
            <CopyButton value={row.locationCode} />
          </span>
        )
      }
    >
      {row && (
        <div className="flex flex-col gap-3">
          <LocationInfo row={row} prefix={prefix} />
          <LocationContents locationCode={row.locationCode} enabled={stockEnabled} />
          <LocationCartons locationCode={row.locationCode} enabled={stockEnabled} />
        </div>
      )}
    </SlideOverPanel>
  );
}
