"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import type { WarehouseLayout } from "@/features/warehouse-map/types";

/**
 * Bóng đổ tĩnh: đèn và vật không đổi khi xoay camera, nên shadow map chỉ vẽ lại khi CẢNH đổi (bố cục,
 * kệ đang xem, hàng trên kệ), không phải mỗi khung hình. Vẽ shadow map mỗi frame cho hàng nghìn chi
 * tiết là một nguồn giật khi xoay.
 */
export function StaticShadows({
  layout,
  focusId,
  stock,
}: {
  layout: WarehouseLayout;
  focusId: string | null;
  stock: ReadonlyMap<string, number | null>;
}) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, invalidate } = get();
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [get, layout, focusId, stock]);
  return null;
}
