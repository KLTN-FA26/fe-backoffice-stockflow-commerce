"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { LOAD_PLANNING_LIMITS } from "@/constants";

import { extentOf } from "../lib/dims";
import { computeLandingGhosts } from "../lib/empty-spaces";

import { historyReducer, initHistory, isDirty } from "./history";
import { kitRefs, peerRefs, trayLines } from "./selectors";
import { useEmptySpaces } from "./use-empty-spaces";

import type { LayoutOrientation } from "@/constants";
import type { LandingGhost } from "../lib/empty-spaces";
import type { EmptySpaceJob } from "./use-empty-spaces";
import type { Axis, EditCommand, EditorState, EditVehicle } from "./types";

/**
 * Toàn bộ trạng thái của màn soạn: lịch sử hoàn tác, xe đang xem, kiện đang chọn, dòng khay đang đặt, và ô gợi ý chỗ
 * đặt / khoảng trống (tính trong worker). Chọn kiện luôn được lọc theo xe và trạng thái hiện tại nên không bao giờ trỏ
 * vào kiện đã rời xe (hoàn tác, đưa ra khay) mà không cần effect dọn dẹp.
 */
export function useEditor(initial: EditorState) {
  const [history, dispatch] = useReducer(historyReducer, initial, initHistory);
  const [seqChoice, setSeq] = useState<number | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [multi, setMulti] = useState(false);
  const [trayChoice, setTrayChoice] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<LayoutOrientation | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const state = history.present;
  const vehicle: EditVehicle = state.vehicles.find((v) => v.seq === seqChoice) ?? state.vehicles[0];
  const onVehicle = useMemo(() => new Set(vehicle.boxes.map((b) => b.ref)), [vehicle.boxes]);
  const selected = useMemo(() => picked.filter((ref) => onVehicle.has(ref)), [picked, onVehicle]);
  const lines = useMemo(() => trayLines(state.tray), [state.tray]);
  const trayLine = lines.find((line) => line.key === trayChoice) ?? null;
  const parcel = trayLine?.parcels[0] ?? null;

  const job = useMemo<EmptySpaceJob | null>(
    () =>
      parcel || showEmpty
        ? { extent: extentOf(vehicle.innerMm), obstacles: [...vehicle.boxes, ...vehicle.gussets] }
        : null,
    [parcel, showEmpty, vehicle],
  );
  const { spaces, computing } = useEmptySpaces(job);
  const ghosts = useMemo<LandingGhost[]>(
    () =>
      parcel && spaces && job && !showEmpty
        ? computeLandingGhosts(job.extent, job.obstacles, parcel, {
            spaces,
            orientation: orientation ?? undefined,
            door: vehicle.door,
          })
        : [],
    [parcel, spaces, job, showEmpty, orientation, vehicle.door],
  );
  const emptyShown = useMemo(
    () =>
      showEmpty
        ? [...(spaces ?? [])]
            .sort((a, b) => b.wMm * b.hMm * b.dMm - a.wMm * a.hMm * a.dMm)
            .slice(0, LOAD_PLANNING_LIMITS.emptySpacesShownMax)
        : null,
    [showEmpty, spaces],
  );

  const run = useCallback((command: EditCommand) => dispatch({ type: "edit", command }), []);
  const clearSelection = useCallback(() => {
    setPicked([]);
    setTrayChoice(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  const seq = vehicle.seq;
  return {
    state,
    vehicle,
    selected,
    multi,
    lines,
    trayLine,
    orientation,
    showEmpty,
    ghosts,
    emptyShown,
    computing,
    notice: history.notice,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dirty: isDirty(history),
    baseline: history.baseline,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    reset: (next: EditorState) => {
      dispatch({ type: "reset", state: next });
      clearSelection();
    },
    selectVehicle: (next: number) => {
      setSeq(next);
      setPicked([]);
    },
    setMulti,
    setOrientation,
    toggleEmpty: () => {
      setShowEmpty((on) => !on);
      clearSelection();
    },
    clearSelection,
    pickBox: (ref: string, additive: boolean) => {
      setTrayChoice(null);
      setPicked((current) => {
        if (multi || additive)
          return current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref];
        return current.length === 1 && current[0] === ref ? [] : [ref];
      });
    },
    pickTrayLine: (key: string) => {
      setPicked([]);
      setOrientation(null);
      setTrayChoice((current) => (current === key ? null : key));
    },
    selectPeers: () => selected[0] && setPicked(peerRefs(vehicle, selected[0])),
    selectKit: () => selected[0] && setPicked(kitRefs(vehicle, selected[0])),
    nudge: (axis: Axis, dir: -1 | 1) => run({ kind: "nudge", seq, refs: selected, axis, dir }),
    rotate: (to: LayoutOrientation) =>
      run({ kind: "rotate", seq, refs: selected, orientation: to }),
    settle: () => run({ kind: "settle", seq }),
    toTray: (refs: readonly string[] = selected) => {
      run({ kind: "toTray", seq, refs });
      setPicked([]);
    },
    /** Đưa các kiện đã chọn ra khay chung rồi mở xe kia, chọn sẵn dòng khay vừa nhận để bấm ô xanh đặt vào. */
    moveToVehicle: (target: number) => {
      const refs = selected;
      const first = vehicle.boxes.find((box) => box.ref === refs[0]);
      if (!first) return;
      run({ kind: "toTray", seq, refs });
      setPicked([]);
      setSeq(target);
      setOrientation(null);
      setTrayChoice(
        trayLines([...state.tray, first]).find((line) =>
          line.parcels.some((p) => p.ref === first.ref),
        )?.key ?? null,
      );
    },
    placeGhost: (id: string) => {
      const ghost = ghosts.find((g) => g.id === id);
      if (!ghost || !parcel) return;
      const { xMm, yMm, zMm, wMm, hMm, dMm, orientation: pose } = ghost;
      run({
        kind: "place",
        seq,
        ref: parcel.ref,
        placement: { xMm, yMm, zMm, wMm, hMm, dMm, orientation: pose },
      });
    },
  };
}

export type EditorModel = ReturnType<typeof useEditor>;
