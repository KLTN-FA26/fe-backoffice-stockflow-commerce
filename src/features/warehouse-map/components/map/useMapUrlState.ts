import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

/** 2D mặt bằng hoặc 3D theo cao độ tầng (docs 06 §1). */
export const MAP_VIEWS = ["2d", "3d"] as const;
export type MapView = (typeof MAP_VIEWS)[number];

/**
 * State bản đồ trên URL (state-persistence: "người khác mở link có thấy cùng thứ không?" → có):
 * kho đang xem, chế độ 2D / 3D, kệ / khu vực đang chọn. F5 và gửi link giữ nguyên.
 */
export function useMapUrlState() {
  const [warehouseId, setWarehouseId] = useQueryState("warehouse", parseAsString);
  const [view, setView] = useQueryState("view", parseAsStringLiteral(MAP_VIEWS).withDefault("2d"));
  const [selectedId, setSelectedId] = useQueryState("selected", parseAsString);
  return {
    warehouseId,
    view,
    selectedId,
    /** Đổi kho → bỏ chọn (id kệ của kho cũ không còn nghĩa). */
    setWarehouseId: (id: string) => {
      void setWarehouseId(id);
      void setSelectedId(null);
    },
    setView: (next: MapView) => void setView(next),
    select: (id: string | null) => void setSelectedId(id),
  };
}

export type MapUrlState = ReturnType<typeof useMapUrlState>;
