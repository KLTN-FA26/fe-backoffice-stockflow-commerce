import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

/** 2D mặt bằng hoặc 3D theo cao độ tầng (docs 06 §1). */
export const MAP_VIEWS = ["2d", "3d"] as const;
export type MapView = (typeof MAP_VIEWS)[number];

/**
 * State bản đồ trên URL (state-persistence: "người khác mở link có thấy cùng thứ không?" → có):
 * chế độ 2D / 3D, kệ / khu vực đang chọn, có hiện vị trí ngừng dùng không. Kho đang xem nằm trong đường dẫn (`/admin/warehouse-map/{prefix}`).
 */
export function useMapUrlState() {
  const [view, setView] = useQueryState("view", parseAsStringLiteral(MAP_VIEWS).withDefault("2d"));
  const [selectedId, setSelectedId] = useQueryState("selected", parseAsString);
  /** Hiện cả kệ / khu vực đã ngừng dùng (mặc định ẩn — BR-04 / BR-07). */
  const [showInactive, setShowInactive] = useQueryState(
    "inactive",
    parseAsBoolean.withDefault(false),
  );
  return {
    view,
    selectedId,
    showInactive,
    toggleInactive: () => void setShowInactive((on) => (on ? null : true)),
    setView: (next: MapView) => void setView(next),
    select: (id: string | null) => void setSelectedId(id),
  };
}

export type MapUrlState = ReturnType<typeof useMapUrlState>;
