"use client";

import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";
import { Box3, Vector3 } from "three";

import type { RefObject } from "react";
import type { CameraControlsImpl } from "@react-three/drei";
import type { CameraPose } from "@/features/warehouse-map/cartons-3d";

/** Thời gian (s) camera trượt tới kệ — đủ để thấy mình đang bay tới đâu, không chờ lâu. */
const SMOOTH_TIME = 0.45;
/** Bay ra toàn cảnh xa hơn nhiều → trượt chậm hơn cho êm, không giật lùi một phát. */
const SMOOTH_TIME_OUT = 0.85;
/** Tâm nhìn không xuống thấp hơn mức này (m). */
const FLOOR_CLEARANCE = 0.15;
/** Tâm nhìn được ra ngoài khung kho bao nhiêu (m) khi dời camera. */
const BOUNDARY_PAD = 10;
/** Đang xem một kệ: lùi xa tối đa bằng ngần này lần khoảng cách bay tới. */
const FOCUS_ZOOM_OUT = 1.6;

const distanceOf = ({ position: p, target: t }: CameraPose) =>
  Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);

/**
 * Điều khiển camera: chuột trái xoay quanh tâm nhìn, phải / giữa dời, lăn để lại gần chỗ con trỏ.
 * Tâm nhìn = kệ / khu vực đang chọn (`focus`, camera bay tới) nên xoay trái chuột là đi vòng 360° quanh
 * kệ; bỏ chọn thì bay về toàn cảnh. Lần đầu đặt thẳng, không bay.
 *
 * Khoá góc: camera luôn ở trên tâm nhìn (không nhìn từ dưới lên), tâm nhìn giới hạn trong khối kho khi
 * dời (không chui xuống dưới sàn). Đang xem kệ thì không lùi xa quá vài lần khoảng cách bay tới.
 */
export function CameraRig({
  controlsRef,
  overview,
  focus,
  bounds,
}: {
  controlsRef: RefObject<CameraControlsImpl | null>;
  overview: CameraPose;
  focus: CameraPose | null;
  bounds: { width: number; height: number; top: number };
}) {
  const placed = useRef(false);
  const span = Math.max(bounds.width, bounds.height);

  useEffect(() => {
    controlsRef.current?.setBoundary(
      new Box3(
        new Vector3(-BOUNDARY_PAD, FLOOR_CLEARANCE, -BOUNDARY_PAD),
        new Vector3(bounds.width + BOUNDARY_PAD, bounds.top, bounds.height + BOUNDARY_PAD),
      ),
    );
  }, [controlsRef, bounds.width, bounds.height, bounds.top]);

  useEffect(() => {
    const pose = focus ?? overview;
    const controls = controlsRef.current;
    if (!controls) return;
    // Chỉ chuyến bay ra toàn cảnh trượt chậm; bay xong trả lại độ nhạy cũ cho lăn / kéo chuột
    controls.smoothTime = focus ? SMOOTH_TIME : SMOOTH_TIME_OUT;
    void controls.setLookAt(...pose.position, ...pose.target, placed.current).then(() => {
      controls.smoothTime = SMOOTH_TIME;
    });
    placed.current = true;
  }, [controlsRef, overview, focus]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={SMOOTH_TIME}
      minDistance={1.5}
      maxDistance={focus ? distanceOf(focus) * FOCUS_ZOOM_OUT : span * 3}
      maxPolarAngle={Math.PI / 2.15}
      dollyToCursor
    />
  );
}
