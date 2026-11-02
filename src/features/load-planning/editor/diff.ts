/**
 * So bản máy chủ mới với bản lúc mở trình soạn khi lưu bị 409 OPTIMISTIC_LOCK — để người dùng XEM người khác đã đổi gì
 * trước khi ghi đè. Chỉ ghi đè được khi hai bên cùng tập xe (cùng loại, cùng cỡ) và cùng tập kiện: BE đòi mọi xe và mọi
 * kiện đúng một lần, nên tập khác nhau chỉ còn cách tải lại.
 */

import { indexParcels } from "./parcels";

import type { Located } from "./parcels";
import type { EditorState } from "./types";

export interface MovedParcel {
  ref: string;
  label: string;
  /** Nơi ở bản bạn mở và bản máy chủ: số xe, hoặc `null` = khay. */
  from: number | null;
  to: number | null;
}

export interface StateDiff {
  /** Kiện chỉ có ở một phía. */
  added: string[];
  removed: string[];
  /** Kiện đổi xe, vào/ra khay hoặc đổi chỗ đặt. */
  moved: MovedParcel[];
  sameVehicles: boolean;
  /** Ghi đè bằng bản của bạn gửi được (cùng xe, cùng kiện). */
  canOverwrite: boolean;
}

const sameSpot = (a: Located, b: Located): boolean =>
  a.seq === b.seq &&
  a.box?.xMm === b.box?.xMm &&
  a.box?.yMm === b.box?.yMm &&
  a.box?.zMm === b.box?.zMm &&
  a.box?.wMm === b.box?.wMm &&
  a.box?.hMm === b.box?.hMm &&
  a.box?.dMm === b.box?.dMm;

export function diffEditorStates(base: EditorState, server: EditorState): StateDiff {
  const before = indexParcels(base);
  const after = indexParcels(server);
  const added = [...after.keys()].filter((ref) => !before.has(ref));
  const removed = [...before.keys()].filter((ref) => !after.has(ref));
  const moved: MovedParcel[] = [];
  for (const [ref, was] of before) {
    const now = after.get(ref);
    if (now && !sameSpot(was, now))
      moved.push({ ref, label: was.parcel.label, from: was.seq, to: now.seq });
  }
  const sameVehicles =
    base.vehicles.length === server.vehicles.length &&
    base.vehicles.every((v, i) => {
      const other = server.vehicles[i];
      return (
        v.seq === other.seq &&
        v.code === other.code &&
        v.innerMm.l === other.innerMm.l &&
        v.innerMm.w === other.innerMm.w &&
        v.innerMm.h === other.innerMm.h
      );
    });
  return {
    added,
    removed,
    moved,
    sameVehicles,
    canOverwrite: sameVehicles && added.length === 0 && removed.length === 0,
  };
}
