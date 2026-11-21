"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";

import { lpnAtlas, lpnLabelGeometry } from "./lpn-label";

import type { CartonPart } from "@/features/warehouse-map/cartons-3d";
import type { ScenePalette } from "./use-scene-palette";

/** Tem LPN thật trên các thùng của kệ đang xem — một texture atlas + một hình gộp = một lần vẽ. */
export function LpnLabels3D({
  cartons,
  palette,
}: {
  cartons: readonly CartonPart[];
  palette: ScenePalette;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const geometry = useMemo(() => lpnLabelGeometry(cartons), [cartons]);
  const atlas = useMemo(
    () =>
      lpnAtlas(
        cartons.map((part) => part.lpn ?? ""),
        palette,
      ),
    [cartons, palette],
  );
  // Mỗi tài nguyên một effect: đổi theme chỉ vẽ lại atlas, không huỷ hình đang dùng
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => {
    invalidate();
    return () => atlas.dispose();
  }, [atlas, invalidate]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} receiveShadow raycast={() => null}>
      <meshStandardMaterial map={atlas} roughness={0.55} metalness={0} />
    </mesh>
  );
}
