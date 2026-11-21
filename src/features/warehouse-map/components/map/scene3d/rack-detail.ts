/**
 * Chi tiết bề mặt kệ 3D, không tải file nào: lỗ đục trên cột và sàn lưới thép là texture vẽ bằng canvas, pallet có
 * nan gỗ, beam / thùng bo cạnh nhỏ. Mọi thứ vẫn là MỘT `InstancedMesh` cho mỗi loại chi tiết (`PartsMesh`).
 *
 * Instancing kéo giãn một hình đơn vị theo cỡ từng chi tiết, nên texture theo UV sẽ giãn theo (cột 6 m thưa lỗ hơn
 * cột 3 m). Lỗ cột và lưới sàn vì vậy lấy toạ độ texture theo MÉT THẾ GIỚI trong shader: 1 ô texture = cố định
 * bao nhiêu mét, kệ cao thấp to nhỏ đều đúng tỉ lệ.
 */

import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import type { BufferGeometry } from "three";

/** Một ô texture lỗ cột = 1 m chiều cao (13 lỗ ≈ bước 77 mm như cột kệ thật). */
const HOLE_TILE_M = 1;
/** Một ô texture lưới sàn = 0.48 m (8 × 8 mắt lưới 60 mm). */
const WIRE_TILE_M = 0.48;

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  color = true,
) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(element);
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Thay toạ độ texture (`vMapUv` / `vAlphaMapUv`) bằng toạ độ thế giới (m) chia cỡ ô — sau `uv_vertex`. */
function worldUv(material: MeshStandardMaterial, varying: string, expr: string) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      {
        vec4 sfWorld = modelMatrix * instanceMatrix * vec4(position, 1.0);
        ${varying} = ${expr};
      }`,
    );
  };
  // Hai vật liệu cùng tham số mà khác shader → khoá cache riêng
  material.customProgramCacheKey = () => `${varying}:${expr}`;
}

/** Cột kệ có hàng lỗ giọt nước; màu sơn nhân vào texture trắng, lỗ tô màu tối `shade` (token cảnh). */
export function uprightMaterial(color: string, shade: string): MeshStandardMaterial {
  const map = canvasTexture(32, 256, (ctx) => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 32, 256);
    ctx.fillStyle = shade;
    const pitch = 256 / 13;
    for (let i = 0; i < 13; i += 1) {
      const y = i * pitch + pitch * 0.22;
      ctx.beginPath();
      ctx.arc(16, y + 3, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(13.8, y + 3, 4.4, pitch * 0.38);
    }
  });
  const material = new MeshStandardMaterial({ color, map, metalness: 0.1, roughness: 0.35 });
  worldUv(material, "vMapUv", `vec2(uv.x, sfWorld.y / ${HOLE_TILE_M.toFixed(2)})`);
  return material;
}

/** Sàn lưới thép mạ kẽm nhìn xuyên được (alpha-to-coverage: xa thì mờ dần như lưới thật, không nhấp nháy). */
export function wireDeckMaterial(color: string): MeshStandardMaterial {
  const alphaMap = canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "white";
      for (let i = 0; i < 8; i += 1) {
        ctx.fillRect(i * 16, 0, 3, 128);
        ctx.fillRect(0, i * 16, 128, 3);
      }
    },
    false,
  );
  const material = new MeshStandardMaterial({
    color,
    alphaMap,
    alphaToCoverage: true,
    side: DoubleSide,
    metalness: 0.6,
    roughness: 0.5,
  });
  worldUv(material, "vAlphaMapUv", `sfWorld.xz / ${WIRE_TILE_M.toFixed(2)}`);
  return material;
}

/**
 * Pallet gỗ trong hộp đơn vị (−0.5…0.5): 3 thanh đáy, 9 cục kê, 3 thanh giằng, 7 nan mặt — instancing co giãn theo
 * cỡ pallet của bin. Tỉ lệ theo pallet 1.2 × 1.0 × 0.14 m.
 */
export function palletGeometry(): BufferGeometry {
  const boards: BufferGeometry[] = [];
  const board = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    boards.push(new BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed());
  for (const z of [-0.45, 0, 0.45]) {
    board(1, 0.15, 0.1, 0, -0.425, z);
    board(1, 0.15, 0.1, 0, 0.275, z);
    for (const x of [-0.458, 0, 0.458]) board(0.083, 0.55, 0.1, x, -0.075, z);
  }
  for (let i = 0; i < 7; i += 1) board(0.083, 0.15, 1, -0.458 + (i * 0.916) / 6, 0.425, 0);
  return mergeGeometries(boards) ?? new BoxGeometry();
}

/**
 * Beam bo cạnh: tiết diện thật (cao × sâu của beam), chiều dài 1 — `PartsMesh` chỉ co theo chiều dài
 * (`baseSize`), cạnh bo không bị kéo méo.
 */
export function beamGeometry(): BufferGeometry {
  return new RoundedBoxGeometry(1, R.beamHeight, R.beamDepth, 2, 0.012);
}
export const BEAM_BASE: [number, number, number] = [1, R.beamHeight, R.beamDepth];

/** Thùng carton bo cạnh (thùng cỡ 0.3–0.6 m nên co giãn đều, cạnh bo ~1–2 cm). Giữ 6 nhóm mặt cho 6 vật liệu. */
export function cartonGeometry(): BufferGeometry {
  return new RoundedBoxGeometry(1, 1, 1, 2, 0.035);
}
