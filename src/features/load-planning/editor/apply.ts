/**
 * Áp một thao tác soạn lên trạng thái: trả trạng thái mới (chỉ xe bị đổi có mảng kiện mới) hoặc lý do từ chối. Mọi thao
 * tác kiểm lại luật như BE (`validatePlacement`, cửa, tải trọng) nên trạng thái soạn không bao giờ chứa một bước đặt/xoay/nhích
 * mà chính trình soạn đã chặn; vi phạm có sẵn từ trước (hoặc do dời kiện đang chống đỡ kiện khác) hiện ở `precheck`.
 */

import { extentOf, orientedExtent, passesDoor } from "../lib/dims";
import { validatePlacement } from "../lib/manual-packing";

import { nudgeBoxes, rotateBoxes, settleBoxes } from "./moves";
import type { Moved } from "./moves";
import { toPlacedBox, toTrayParcel, weightOf } from "./parcels";

import type { EditCommand, EditResult, EditVehicle, EditorState } from "./types";

const withVehicle = (
  state: EditorState,
  seq: number,
  boxes: EditVehicle["boxes"],
  tray: EditorState["tray"] = state.tray,
): EditorState => ({
  vehicles: state.vehicles.map((v) => (v.seq === seq ? { ...v, boxes } : v)),
  tray,
});

function applyMoved(state: EditorState, seq: number, moved: Moved): EditResult {
  return moved.ok ? { ok: true, state: withVehicle(state, seq, moved.boxes) } : moved;
}

function place(
  state: EditorState,
  vehicle: EditVehicle,
  cmd: Extract<EditCommand, { kind: "place" }>,
): EditResult {
  const parcel = state.tray.find((p) => p.ref === cmd.ref);
  if (!parcel) return { ok: false, reason: "notFound" };
  const { placement } = cmd;
  const expected = orientedExtent(parcel.origMm, placement.orientation);
  const sameExtent =
    expected.wMm === placement.wMm &&
    expected.hMm === placement.hMm &&
    expected.dMm === placement.dMm;
  if (!sameExtent || (!parcel.rotatable && placement.orientation !== "LWH"))
    return { ok: false, reason: "placeInvalid" };
  const check = validatePlacement(
    placement,
    extentOf(vehicle.innerMm),
    vehicle.boxes,
    vehicle.gussets,
  );
  if (!check.ok || !passesDoor(placement, vehicle.door))
    return { ok: false, reason: "placeInvalid" };
  if (weightOf(vehicle.boxes) + parcel.weightKg > vehicle.maxPayloadKg)
    return { ok: false, reason: "overweight" };
  return {
    ok: true,
    state: withVehicle(
      state,
      vehicle.seq,
      [...vehicle.boxes, toPlacedBox(parcel, placement)],
      state.tray.filter((p) => p.ref !== cmd.ref),
    ),
  };
}

export function applyEdit(state: EditorState, cmd: EditCommand): EditResult {
  const vehicle = state.vehicles.find((v) => v.seq === cmd.seq);
  if (!vehicle) return { ok: false, reason: "notFound" };
  switch (cmd.kind) {
    case "place":
      return place(state, vehicle, cmd);
    case "nudge":
      return applyMoved(state, cmd.seq, nudgeBoxes(vehicle, cmd.refs, cmd.axis, cmd.dir));
    case "rotate":
      return applyMoved(state, cmd.seq, rotateBoxes(vehicle, cmd.refs, cmd.orientation));
    case "settle":
      return applyMoved(state, cmd.seq, settleBoxes(vehicle));
    case "toTray": {
      const leaving = new Set(cmd.refs);
      const moved = vehicle.boxes.filter((box) => leaving.has(box.ref));
      if (moved.length === 0) return { ok: false, reason: "notFound" };
      return {
        ok: true,
        state: withVehicle(
          state,
          cmd.seq,
          vehicle.boxes.filter((box) => !leaving.has(box.ref)),
          [...state.tray, ...moved.map(toTrayParcel)],
        ),
      };
    }
  }
}
