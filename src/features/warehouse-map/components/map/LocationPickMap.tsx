"use client";

import { useState } from "react";

import { UI_LABELS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import {
  areaLocationCode,
  placesOf,
  shelfOfLocation,
} from "@/features/warehouse-map/location-pick";
import { useWarehouseLayout } from "@/features/warehouse-map/queries";

import { Skeleton } from "@/components/ui/skeleton";

import { MapFrame } from "../shared/MapFrame";
import { MapCanvas2D } from "./MapCanvas2D";
import { PickOverlay } from "./PickOverlay";
import { ShelfBinPicker } from "./ShelfBinPicker";

const K = UI_LABELS.warehouseMap.pick;
const FRAME_CLASS = "flex h-80 flex-col";
const NOTE_CLASS = "text-ink-tertiary text-xs";

export interface LocationPickMapProps {
  warehouseId: string;
  /** Mã vị trí cần đánh dấu (vd nơi các thùng đang nằm). */
  marked: readonly string[];
  /** Mã vị trí gợi ý theo thứ hạng — phần tử đầu tô đậm nhất. Thứ hạng do màn gọi quyết định. */
  suggested?: readonly string[];
  /** Mã vị trí được chọn — quy tắc chọn (dùng được, không khu tập kết…) do màn gọi quyết định. */
  pickable: ReadonlySet<string>;
  /** Vị trí đang chọn (in hoa), rỗng khi chưa chọn. */
  value: string;
  disabled?: boolean;
  onPick: (code: string) => void;
}

function Legend({ suggested }: { suggested: boolean }) {
  return (
    <div className={`${NOTE_CLASS} flex flex-wrap items-center gap-x-4 gap-y-1`}>
      <span className="flex items-center gap-1.5">
        <span
          className="border-dot-warning size-2.5 rounded-(--r-sm) border border-dashed"
          aria-hidden
        />
        {K.legendMarked}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="border-dot-positive bg-positive/10 size-2.5 rounded-(--r-sm) border"
          aria-hidden
        />
        {K.legendPicked}
      </span>
      {suggested && (
        <span className="flex items-center gap-1.5">
          <span
            className="border-dot-info bg-dot-info/25 size-2.5 rounded-(--r-sm) border"
            aria-hidden
          />
          {K.legendSuggested}
        </span>
      )}
    </div>
  );
}

/**
 * Chọn vị trí trên Kho Map 2D (docs 11 §4.1 bước 1–2): tô nơi các thùng đang nằm, bấm khu để chọn làm đích, bấm kệ để
 * chọn bin trong lưới bin của kệ. Cần `warehouse-locations:READ` — thiếu quyền / lỗi tải thì chỉ hiện một dòng, ô nhập
 * mã vị trí vẫn dùng được. Không biết nghiệp vụ của màn gọi: chỉ nhận danh sách mã được chọn.
 */
export function LocationPickMap({
  warehouseId,
  marked,
  suggested = [],
  pickable,
  value,
  disabled = false,
  onPick,
}: LocationPickMapProps) {
  const canRead = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const layout = useWarehouseLayout(warehouseId, canRead);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  if (!canRead) return <p className={NOTE_CLASS}>{K.noRead}</p>;
  if (layout.isPending) return <Skeleton className="h-80 w-full rounded-(--card-radius)" />;
  if (!layout.data) return <p className={NOTE_CLASS}>{K.loadFailed}</p>;
  const map = layout.data;
  const top = placesOf(map, suggested.slice(0, 1));
  const topIds = new Set(top.map((mark) => mark.id));
  const rest = placesOf(map, suggested.slice(1)).filter((mark) => !topIds.has(mark.id));
  // Kệ đang mở lưới bin: kệ vừa bấm, hoặc kệ chứa bin đích đang chọn (gõ / quét mã cũng mở sẵn)
  const shelf =
    map.shelves.find((item) => item.id === selectedId) ??
    (selectedId === null ? shelfOfLocation(map, value) : undefined);
  const select = (id: string | null) => {
    setSelectedId(id);
    setRefused(null);
    const code = id ? areaLocationCode(map, id) : null;
    if (code === null || disabled) return;
    if (pickable.has(code)) onPick(code);
    else setRefused(K.notPickable(code));
  };
  return (
    <section aria-label={K.label} className="space-y-2">
      <div className={FRAME_CLASS}>
        <MapFrame layout={map}>
          {(controls) => (
            <MapCanvas2D
              layout={map}
              selectedId={selectedId}
              onSelect={select}
              controls={controls}
              overlay={
                <PickOverlay
                  marked={placesOf(map, marked)}
                  picked={placesOf(map, [value])}
                  suggested={rest}
                  top={top}
                />
              }
            />
          )}
        </MapFrame>
      </div>
      <Legend suggested={suggested.length > 0} />
      <p className={NOTE_CLASS}>{K.hint}</p>
      {refused && (
        <p role="status" className="text-ink-secondary text-xs">
          {refused}
        </p>
      )}
      {shelf && (
        <ShelfBinPicker
          shelf={shelf}
          marked={new Set(marked.map((code) => code.trim().toUpperCase()))}
          suggested={suggested}
          pickable={pickable}
          value={value}
          disabled={disabled}
          onPick={onPick}
        />
      )}
      <p className={NOTE_CLASS}>{K.note}</p>
    </section>
  );
}
