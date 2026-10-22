/**
 * Kiểu của trình soạn xếp tay (PR F5). Trạng thái soạn là bản sao có thể sửa của `Layout` các xe + khay kiện chưa xếp;
 * mảng kiện của xe không đổi thì giữ nguyên tham chiếu (chia sẻ cấu trúc) nên hoàn tác rẻ và kiểm tra luật cache theo xe.
 */

import type { LayoutOrientation } from "@/constants";
import type { BlockMm, DimsMm, DoorMm, LayoutBox } from "../types";

/** Thông tin cố định của một kiện — phần của `LayoutBox` không phụ thuộc chỗ đặt. */
export type TrayParcel = Omit<LayoutBox, keyof BlockMm | "orientation">;

/** Chỗ đặt của một kiện: góc nhỏ nhất, kích thước đã xếp theo ba trục và hướng đặt. */
export interface Placement extends BlockMm {
  orientation: LayoutOrientation;
}

export interface EditVehicle {
  seq: number;
  code: string;
  vehicleTypeId: string;
  innerMm: DimsMm;
  maxPayloadKg: number;
  gussets: readonly BlockMm[];
  /** Cửa xe nếu biết (loại xe đang dùng); null = không kiểm vế cửa ở FE, BE vẫn kiểm. */
  door: DoorMm | null;
  boxes: readonly LayoutBox[];
}

export interface EditorState {
  vehicles: readonly EditVehicle[];
  /** Mọi kiện của kế hoạch chưa có xe: kiện solver không xếp được và kiện người dùng đưa ra khay. */
  tray: readonly TrayParcel[];
}

export type Axis = "x" | "y" | "z";

/** Một thao tác soạn — mỗi thao tác thành công là MỘT bước hoàn tác. */
export type EditCommand =
  | { kind: "toTray"; seq: number; refs: readonly string[] }
  | { kind: "place"; seq: number; ref: string; placement: Placement }
  | { kind: "nudge"; seq: number; refs: readonly string[]; axis: Axis; dir: -1 | 1 }
  | { kind: "rotate"; seq: number; refs: readonly string[]; orientation: LayoutOrientation }
  | { kind: "settle"; seq: number };

/** Vì sao một thao tác bị từ chối (trạng thái không đổi, không có bước hoàn tác). */
export type RejectReason =
  | "notFound"
  | "placeInvalid"
  | "overweight"
  | "nudgeBlocked"
  | "rotateForbidden"
  | "rotateNoFit"
  | "unchanged"
  | "nothingToSettle";

export type EditResult = { ok: true; state: EditorState } | { ok: false; reason: RejectReason };
