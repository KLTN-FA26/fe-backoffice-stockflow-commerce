"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import { NeutralToneMapping } from "three";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { shelfHeight, zoneColors } from "@/features/warehouse-map/selectors";

import { MapControls } from "../shared/MapControls";
import { Areas3D } from "./scene3d/Areas3D";
import { CameraRig } from "./scene3d/CameraRig";
import { Cartons3D } from "./scene3d/Cartons3D";
import { Floor3D } from "./scene3d/Floor3D";
import { FocusCard } from "./scene3d/FocusCard";
import { Racks3D } from "./scene3d/Racks3D";
import { SceneLights } from "./scene3d/SceneLights";
import { ShelfFocus3D } from "./scene3d/ShelfFocus3D";
import { StaticShadows } from "./scene3d/StaticShadows";
import { useSceneFocus } from "./scene3d/use-scene-focus";
import { useScenePalette } from "./scene3d/use-scene-palette";
import { Walls3D } from "./scene3d/Walls3D";

import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { MapControlsProps } from "../shared/MapControls";

/**
 * Cảnh 3D — dựng lại từ CÙNG dữ liệu bố cục với 2D (docs 06 §1): trục x = x bản đồ, trục z = y bản đồ,
 * trục y = cao độ tầng. Kệ pallet thép, sàn epoxy, băng keo khu vực, tường cắt thấp. Bấm kệ → chỉ còn
 * kệ đó trên sàn, camera bay tới và xoay vòng 360° quanh kệ; thùng carton hiện đúng bin có tồn, thẻ
 * bên trái liệt kê hàng (tồn theo vị trí — bản đồ vẫn chỉ trực quan, BR-05). Nạp lười qua `next/dynamic`.
 *
 * Hiệu năng (không giật khi xoay): `InstancedMesh` tĩnh — vài lần vẽ cho cả kho, không tính lại ma trận
 * mỗi frame; chỉ vẽ khi có thay đổi (`frameloop="demand"`); bóng đổ vẽ lại khi cảnh đổi chứ không theo
 * camera; một đèn đổ bóng; phản chiếu dựng một lần; độ phân giải cố định (không nhảy mờ / nét).
 */
export default function MapScene3D({
  layout,
  selectedId,
  onSelect,
  onOpenDetail,
  controls,
}: {
  layout: WarehouseLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDetail: () => void;
  controls: Omit<MapControlsProps, "zoom">;
}) {
  const palette = useScenePalette();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Mất WebGL context (driver, quá nhiều context trên trang) → dựng lại Canvas thay vì để cảnh trống
  const [glGeneration, setGlGeneration] = useState(0);
  useCursor(hoveredId !== null);
  const focus = useSceneFocus(layout, selectedId, onSelect);
  const { shelf } = focus;
  const { mapWidth: w, mapHeight: h } = layout.warehouse;
  const span = Math.max(w, h);
  // Trần của vùng camera: cao hơn kệ / tường cao nhất một chút
  const top = Math.max(LIMITS.wallHeight3d, ...layout.shelves.map(shelfHeight)) + 2;
  // Đang xem một kệ: chỉ hiện kệ đó (không khu vực, tường, kệ khác che tầm xoay quanh)
  const isolated = useMemo(() => (shelf ? [shelf] : []), [shelf]);
  const shelves = shelf ? isolated : layout.shelves;
  const colorsByZone = useMemo(() => zoneColors(layout), [layout]);
  const target = shelf ?? focus.area;

  return (
    <div className="relative h-full">
      <Canvas
        key={glGeneration}
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: focus.overview.position, fov: 40, near: 0.1, far: span * 12 }}
        // Tone mapping trung tính giữ đúng sắc độ màu sơn (ACES mặc định của R3F làm bạc, nhợt màu)
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          // Phơi sáng thấp hơn mặc định một chút: sàn trắng không loá, màu sơn rõ
          gl.toneMappingExposure = 0.85;
          gl.domElement.addEventListener("webglcontextlost", () => setGlGeneration((n) => n + 1), {
            once: true,
          });
        }}
        onPointerMissed={() => onSelect(null)}
        className="bg-bg-subtle rounded-(--card-radius)"
      >
        <SceneLights width={w} height={h} palette={palette} />
        <Floor3D width={w} height={h} palette={palette} focus={shelf} />
        {!shelf && (
          <Areas3D
            areas={layout.areas}
            selectedId={selectedId}
            palette={palette}
            onSelect={onSelect}
          />
        )}
        {/* Kệ cả kho luôn dựng sẵn, xem một kệ thì chỉ ẩn đi — thoát ra không phải dựng lại (không giật
            đúng lúc camera bay về toàn cảnh) */}
        <group visible={!shelf}>
          <Racks3D
            shelves={layout.shelves}
            zoneColors={colorsByZone}
            palette={palette}
            onSelect={onSelect}
            onHover={setHoveredId}
            interactive={!shelf}
          />
        </group>
        {shelf && (
          <Racks3D
            shelves={isolated}
            zoneColors={colorsByZone}
            palette={palette}
            focus={focus.rackFocus}
            onSelect={onSelect}
            onHover={setHoveredId}
          />
        )}
        {shelf && <Cartons3D shelf={shelf} stock={focus.stock} palette={palette} />}
        {!shelf && <Walls3D boundaries={layout.boundaries} palette={palette} />}
        {shelves
          .filter((s) => s.id === selectedId || s.id === hoveredId)
          .map((s) => (
            <ShelfFocus3D key={s.id} shelf={s} color={palette.info} strong={s.id === selectedId} />
          ))}
        <StaticShadows layout={layout} focusId={selectedId} stock={focus.stock} />
        <CameraRig
          controlsRef={focus.cameraRef}
          overview={focus.overview}
          focus={focus.pose}
          bounds={{ width: w, height: h, top }}
        />
      </Canvas>
      {target && (
        <FocusCard
          code={target.code}
          name={target.name}
          stock={shelf ? focus.stockState : undefined}
          onDetail={onOpenDetail}
          onOverview={focus.toOverview}
        />
      )}
      <MapControls {...controls} zoom={focus.zoom} />
    </div>
  );
}
