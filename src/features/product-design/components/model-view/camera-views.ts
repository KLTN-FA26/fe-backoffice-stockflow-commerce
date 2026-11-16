/**
 * Where the camera stands, as plain numbers (no three, no WebGL): framed on the model's real bounding box in
 * millimetres, starting on the front of the product (front +Z; a cup's seam is at the back, −Z), and the "turn to"
 * views, one for each print area (a cup: front and back; a bag: each face it has).
 */
import { MODEL3D_VIEW_LABELS } from "@/constants/labels-model3d";
import { MODEL3D_VIEW as VIEW } from "@/constants/numbers";

import type { PrintAreaCode } from "../../model3d/model-types";

export type Vec3 = [number, number, number];

/** What of a `Box3` the framing reads (so a test can pass a plain box). */
export interface BoxLike {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface Framing {
  centre: Vec3;
  /** Half the diagonal of the box: a sphere that holds the whole model. */
  radius: number;
  /** How far the camera stands from the centre to see that sphere whole. */
  distance: number;
}

/** The sphere of the box and the distance at which it fits the camera's narrower field. */
export function framingOf(box: BoxLike, aspect = 1): Framing {
  const centre: Vec3 = [
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  ];
  const radius =
    Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) / 2;
  const halfVertical = (VIEW.fovDeg * Math.PI) / 360;
  const halfNarrow = Math.min(halfVertical, Math.atan(Math.tan(halfVertical) * aspect));
  return { centre, radius, distance: (radius / Math.sin(halfNarrow)) * VIEW.framingMargin };
}

/** A unit direction from the centre towards the camera, raised by the viewing elevation. */
function direction(x: number, z: number): Vec3 {
  const lift = (VIEW.elevationDeg * Math.PI) / 180;
  const flat = Math.hypot(x, z) || 1;
  return [(x / flat) * Math.cos(lift), Math.sin(lift), (z / flat) * Math.cos(lift)];
}

export const FRONT_DIRECTION = direction(0, 1);

export function cameraPositionFor({ centre, distance }: Framing, toward: Vec3): Vec3 {
  return [
    centre[0] + toward[0] * distance,
    centre[1] + toward[1] * distance,
    centre[2] + toward[2] * distance,
  ];
}

/** The camera at the start: on +Z of the centre, the front of the product. */
export const startPosition = (framing: Framing): Vec3 =>
  cameraPositionFor(framing, FRONT_DIRECTION);

export type ViewId = keyof typeof MODEL3D_VIEW_LABELS.turn;

export interface ViewTarget {
  id: ViewId;
  label: string;
  direction: Vec3;
}

const target = (id: ViewId, x: number, z: number): ViewTarget => ({
  id,
  label: MODEL3D_VIEW_LABELS.turn[id],
  direction: direction(x, z),
});

/** Bag faces, with the side each is seen from (the same sides `printGeometry` faces them to). */
const BAG_VIEWS: readonly [PrintAreaCode, ViewTarget][] = [
  ["FRONT", target("FRONT", 0, 1)],
  ["RIGHT", target("RIGHT", 1, 0)],
  ["BACK", target("BACK", 0, -1)],
  ["LEFT", target("LEFT", -1, 0)],
];

/** One view for each print area to look at: a cup has the front and the back (its seam); a bag, each face it has. */
export function viewTargets(kind: "cup" | "bag", codes: readonly PrintAreaCode[]): ViewTarget[] {
  if (kind === "cup") return [target("BODY-front", 0, 1), target("BODY-back", 0, -1)];
  return BAG_VIEWS.filter(([code]) => codes.includes(code)).map(([, view]) => view);
}
