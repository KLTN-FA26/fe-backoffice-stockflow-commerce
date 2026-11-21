"use client";

import { useEffect, useMemo } from "react";
import { CylinderGeometry } from "three";

import { areaPropParts } from "@/features/warehouse-map/area-props-3d";

import { TONE_VAR } from "../tone";
import { PartsMesh } from "./PartsMesh";

import type { AreaPropKind, AreaPropPart } from "@/features/warehouse-map/area-props-3d";
import type { LayoutArea } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

const MATERIAL: Record<AreaPropKind, { metalness: number; roughness: number }> = {
  metal: { metalness: 0.55, roughness: 0.4 },
  rubber: { metalness: 0, roughness: 0.85 },
  top: { metalness: 0, roughness: 0.7 },
  hazard: { metalness: 0.1, roughness: 0.45 },
  belt: { metalness: 0, roughness: 0.6 },
  sign: { metalness: 0, roughness: 0.8 },
};

/**
 * Thiết bị theo loại khu vực (area-props-3d) — instancing theo (vật liệu × hình hộp / trụ), không bắt chuột: bấm
 * xuyên xuống mặt khu để chọn khu như cũ.
 */
export function AreaProps3D({
  areas,
  palette,
}: {
  areas: readonly LayoutArea[];
  palette: ScenePalette;
}) {
  const cylinder = useMemo(() => new CylinderGeometry(0.5, 0.5, 1, 18), []);
  useEffect(() => () => cylinder.dispose(), [cylinder]);
  const groups = useMemo(() => {
    const byKey = new Map<string, AreaPropPart[]>();
    for (const part of areaPropParts(areas)) {
      const key = `${part.kind}:${part.shape}`;
      byKey.set(key, [...(byKey.get(key) ?? []), part]);
    }
    return [...byKey.entries()];
  }, [areas]);
  const color: Record<AreaPropKind, string> = {
    metal: palette.deck,
    rubber: palette.wall,
    top: palette.pallet,
    hazard: palette.tape,
    belt: palette.css(TONE_VAR.danger),
    sign: palette.label,
  };
  return (
    <>
      {groups.map(([key, parts]) => {
        const [first] = parts;
        if (!first) return null;
        return (
          <PartsMesh
            key={key}
            parts={parts}
            color={color[first.kind]}
            {...MATERIAL[first.kind]}
            castShadow={first.size[1] > 0.01}
            {...(first.shape === "cylinder" ? { geometry: cylinder } : {})}
          />
        );
      })}
    </>
  );
}
