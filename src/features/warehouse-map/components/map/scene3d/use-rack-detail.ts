"use client";

import { useEffect, useMemo } from "react";

import {
  BEAM_BASE,
  beamGeometry,
  palletGeometry,
  uprightMaterial,
  wireDeckMaterial,
} from "./rack-detail";

import type { BufferGeometry, Material } from "three";
import type { RackPartKind } from "@/features/warehouse-map/rack-3d";
import type { ScenePalette } from "./use-scene-palette";

export interface PartDetail {
  materials?: Material;
  geometry?: BufferGeometry;
  baseSize?: readonly [number, number, number];
}

/**
 * Hình / vật liệu riêng của từng loại chi tiết kệ (rack-detail): lỗ cột, sàn lưới, beam bo cạnh, pallet có nan.
 * Dựng lại khi bảng màu đổi, giải phóng GPU khi đổi / rời cảnh.
 */
export function useRackDetail(palette: ScenePalette): Partial<Record<RackPartKind, PartDetail>> {
  const detail = useMemo(
    () => ({
      upright: uprightMaterial(palette.steel, palette.wall),
      deck: wireDeckMaterial(palette.deck),
      beam: beamGeometry(),
      pallet: palletGeometry(),
    }),
    [palette],
  );
  useEffect(
    () => () => {
      for (const material of [detail.upright, detail.deck]) {
        material.map?.dispose();
        material.alphaMap?.dispose();
        material.dispose();
      }
      detail.beam.dispose();
      detail.pallet.dispose();
    },
    [detail],
  );
  return {
    upright: { materials: detail.upright },
    deck: { materials: detail.deck },
    beam: { geometry: detail.beam, baseSize: BEAM_BASE },
    pallet: { geometry: detail.pallet },
  };
}
