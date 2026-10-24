import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";

/**
 * Hình học các cạnh gộp của mọi kiện (một `LineSegments`). Tự tạo nên R3F không tự giải phóng khi đổi: giải phóng hình
 * học cũ mỗi lần dữ liệu đổi và khi gỡ khung (không rò bộ nhớ GPU qua nhiều lần chỉnh).
 */
export function useEdgeGeometry(positions: Float32Array): BufferGeometry {
  const geometry = useMemo(() => {
    const created = new BufferGeometry();
    created.setAttribute("position", new BufferAttribute(positions, 3));
    return created;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
