"use client";

import { useMemo } from "react";

import { rackParts } from "@/features/warehouse-map/rack-3d";

import { locationTone, TONE_VAR } from "../tone";
import { PartsMesh } from "./PartsMesh";

import type { RackPart, RackPartKind } from "@/features/warehouse-map/rack-3d";
import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/**
 * Vật liệu từng loại chi tiết — khung / beam là thép SƠN tĩnh điện (ít kim loại: kim loại cao phản
 * chiếu môi trường trắng làm màu sơn bạc đi), sàn lưới mạ kẽm, gỗ / nhựa nhám.
 */
const MATERIAL: Record<RackPartKind, { metalness: number; roughness: number }> = {
  upright: { metalness: 0.1, roughness: 0.35 },
  brace: { metalness: 0.1, roughness: 0.4 },
  beam: { metalness: 0.05, roughness: 0.32 },
  deck: { metalness: 0.6, roughness: 0.5 },
  pallet: { metalness: 0, roughness: 0.9 },
  tote: { metalness: 0, roughness: 0.6 },
  label: { metalness: 0, roughness: 0.8 },
};
const KINDS = Object.keys(MATERIAL) as RackPartKind[];

/**
 * Mọi kệ của kho vẽ bằng instancing: mỗi loại chi tiết (cột, giằng, beam, sàn lưới, pallet, thùng,
 * nhãn) là MỘT lần vẽ cho cả kho dù có hàng trăm kệ. Beam theo màu zone; nhãn vị trí trắng khi bin dùng
 * được, theo tone trạng thái khi không (BR-16 `effectiveStatus`).
 */
export function Racks3D({
  shelves,
  zoneColors,
  palette,
  focus,
  onSelect,
  onHover,
}: {
  shelves: readonly LayoutShelf[];
  zoneColors: ReadonlyMap<string, string>;
  palette: ScenePalette;
  /** Kệ đang xem + mã vị trí có thùng carton → bỏ thùng nhựa rỗng ở đó. */
  focus?: { shelfId: string; stocked: ReadonlySet<string> };
  onSelect: (shelfId: string) => void;
  onHover: (shelfId: string | null) => void;
}) {
  // Tính lại chi tiết + màu chỉ khi bố cục / bảng màu đổi — không phải khi xoay camera hay trỏ chuột
  const groups = useMemo(() => {
    const byKind = new Map<RackPartKind, RackPart[]>(KINDS.map((kind) => [kind, []]));
    for (const shelf of shelves)
      for (const part of rackParts(shelf, shelf.id === focus?.shelfId ? focus.stocked : undefined))
        byKind.get(part.kind)?.push(part);
    const zoneOf = new Map(
      shelves.map((s) => [s.id, s.zoneId ? zoneColors.get(s.zoneId) : undefined]),
    );
    const colorOf = (part: RackPart) =>
      part.kind === "beam"
        ? (zoneOf.get(part.shelfId) ?? palette.beam)
        : part.binUsable
          ? palette.label
          : palette.css(TONE_VAR[locationTone(part.binStatus ?? "")]);
    return KINDS.map((kind) => {
      const parts = byKind.get(kind) ?? [];
      const tinted = kind === "beam" || kind === "label";
      return { kind, parts, colors: tinted ? parts.map(colorOf) : undefined };
    });
  }, [shelves, focus, zoneColors, palette]);

  const baseColor: Record<RackPartKind, string> = {
    upright: palette.steel,
    brace: palette.steel,
    beam: "white",
    deck: palette.deck,
    pallet: palette.pallet,
    tote: palette.tote,
    label: "white",
  };

  return (
    <>
      {groups.map(({ kind, parts, colors }) =>
        parts.length === 0 ? null : (
          <PartsMesh
            key={kind}
            parts={parts}
            colors={colors}
            color={baseColor[kind]}
            castShadow={kind !== "label"}
            {...MATERIAL[kind]}
            onPick={(index) => {
              const part = parts[index];
              if (part) onSelect(part.shelfId);
            }}
            onHover={(index) => onHover(index === null ? null : (parts[index]?.shelfId ?? null))}
          />
        ),
      )}
    </>
  );
}
