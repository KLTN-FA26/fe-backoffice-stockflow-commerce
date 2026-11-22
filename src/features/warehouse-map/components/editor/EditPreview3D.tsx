"use client";

import { useMemo, useState } from "react";

import { layoutFromDraft } from "@/features/warehouse-map/draft-layout";

import { MapViewer3D } from "../map/MapViewer3D";

import type { MapDraft } from "@/features/warehouse-map/draft-types";
import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapControlsProps } from "../shared/MapControls";

/**
 * Xem 3D bản nháp đang sửa (chưa lưu) — dựng lại từ bản nháp, chỉ xem: bấm kệ để camera bay tới, không mở chi
 * tiết, không sửa. Chọn trong 3D là state riêng, không đụng hình đang chọn của trình sửa 2D.
 */
export function EditPreview3D({
  layout,
  draft,
  controls,
}: {
  layout: WarehouseLayout;
  draft: MapDraft;
  controls: Omit<MapControlsProps, "zoom">;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Giữ tham chiếu khi bản nháp không đổi: cảnh 3D dựng lại instancing theo tham chiếu kệ, hover mà tạo
  // bố cục mới mỗi lần render là tính lại toàn bộ chi tiết kệ
  const preview = useMemo(() => layoutFromDraft(layout, draft), [layout, draft]);
  return (
    <MapViewer3D
      layout={preview}
      selectedId={selectedId}
      onSelect={setSelectedId}
      controls={controls}
    />
  );
}
