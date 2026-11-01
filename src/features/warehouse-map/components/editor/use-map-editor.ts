"use client";

import { useReducer, useState } from "react";

import { TOAST_MESSAGES } from "@/constants";

import { changeCount, isChanged } from "@/features/warehouse-map/draft";
import { newKeyOf } from "@/features/warehouse-map/draft-edit";
import {
  nudgedFootprint,
  nudgedLine,
  rotatedFootprint,
} from "@/features/warehouse-map/draft-geometry";
import { duplicatedGroup } from "@/features/warehouse-map/draft-group";
import { historyFromLayout, historyReducer } from "@/features/warehouse-map/draft-history";
import { validateDraft } from "@/features/warehouse-map/draft-rules";
import { groupRemovable, moveBlock, placeLocks } from "@/features/warehouse-map/lifecycle";
import { usePlaceHasStock } from "@/features/warehouse-map/queries";

import { toast } from "@/components/shared/Toast";

import { stockProbe, useGroupStock } from "./use-group-stock";

import type { DraftItem } from "@/features/warehouse-map/draft";
import type { DraftTool, DrawnShape } from "@/features/warehouse-map/draft-edit";
import type { EditPermissions, StockState } from "@/features/warehouse-map/lifecycle";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

const T = TOAST_MESSAGES.warehouseMap;

/**
 * State của chế độ sửa: bản nháp có lịch sử hoàn tác (reducer thuần), công cụ, vùng chọn, lỗi luật, tồn
 * của hình đang chọn và phần được sửa (`placeLocks`). Chọn MỘT hình → sửa / kéo / xoay / thông số; chọn
 * NHIỀU (kéo vùng, Shift + bấm) → sao chép, nhân bản, dán, xoá cả nhóm. Hình đã lưu chỉ kéo được khi
 * đang chọn riêng nó và đã biết không còn hàng.
 */
export function useMapEditor(layout: WarehouseLayout, can: EditPermissions) {
  const [history, dispatch] = useReducer(historyReducer, layout, historyFromLayout);
  const draft = history.present;
  const [tool, setTool] = useState<DraftTool>("select");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  /** Hình đã sao chép (Ctrl+C) — chỉ trong phiên sửa này, không ghi vào clipboard hệ điều hành. */
  const [clipboard, setClipboard] = useState<DraftItem[]>([]);
  const issues = validateDraft(draft, layout.warehouse);
  // Vùng chọn lọc theo bản nháp hiện tại (sau hoàn tác / xoá, khoá không còn thì tự rơi ra)
  const chosen = draft.items.filter((item) => selectedKeys.includes(item.key));
  const selected = chosen.length === 1 ? (chosen[0] ?? null) : null;
  const selectedKey = selected?.key ?? null;
  const group = chosen.length > 1 ? chosen : [];
  const probe = stockProbe(layout.warehouse, selected);
  const stockQuery = usePlaceHasStock(probe);
  const stock: StockState = !probe
    ? "free"
    : stockQuery.isError
      ? "unknown"
      : stockQuery.data === undefined
        ? "checking"
        : stockQuery.data
          ? "stocked"
          : "free";
  const groupStock = useGroupStock(layout.warehouse, group);
  const locks = selected ? placeLocks(selected, stock, can) : null;

  const select = (key: string | null) => setSelectedKeys(key ? [key] : []);
  /** `tag`: thao tác liền nhau cùng tag gộp thành một bước hoàn tác (gõ trong modal, dời bằng phím). */
  const change = (key: string, apply: (item: DraftItem) => DraftItem, tag?: string) =>
    dispatch({ type: "update", key, apply, tag });
  /**
   * Thử dời / xoay / đổi cỡ hình đang chọn mà bị khoá → báo lý do (BR-04: còn hàng không được dời).
   * Cùng `id` toast theo hình: giữ phím mũi tên chỉ thay toast cũ, không chồng thêm.
   */
  const warnBlockedMove = (key: string) => {
    if (!selected || selected.key !== key) return;
    const block = moveBlock(selected, stock, can);
    if (!block) return;
    // Tường / cửa không có tồn (không bao giờ "stocked") — chỉ kệ / khu vực mang mã
    const code = selected.kind === "boundary" ? "" : selected.code;
    const message = block === "stocked" ? T.moveBlocked.stocked(code) : T.moveBlocked[block];
    toast.warning(message, undefined, { id: `move-blocked:${key}` });
  };
  const changeSelected = (apply: (item: DraftItem) => DraftItem, tag?: string) => {
    if (!selected || !locks) return;
    if (locks.geometry) return warnBlockedMove(selected.key);
    change(selected.key, apply, tag);
  };
  /** Dán bản sao của `sources` dưới nhóm gốc rồi chọn chúng; trả bản sao để dán nối tiếp. */
  const pasteCopies = (sources: DraftItem[]) => {
    const copies = duplicatedGroup(draft, sources);
    if (copies.length === 0) return copies;
    dispatch({ type: "pasteMany", items: sources });
    setSelectedKeys(copies.map((copy) => copy.key));
    return copies;
  };
  /** Chọn hình kế tiếp / trước đó theo thứ tự trong bản nháp (Tab / Shift+Tab). */
  const cycle = (step: 1 | -1) => {
    const keys = draft.items.map((item) => item.key);
    if (keys.length === 0) return;
    const at = selectedKey ? keys.indexOf(selectedKey) : -1;
    const next =
      at < 0 ? (step === 1 ? 0 : keys.length - 1) : (at + step + keys.length) % keys.length;
    select(keys[next] ?? null);
  };

  return {
    draft,
    dispatch,
    tool,
    setTool,
    selected,
    selectedKey,
    selectedKeys: chosen.map((item) => item.key),
    groupSize: group.length,
    select,
    /** Kéo vùng: thay vùng chọn, hoặc gộp thêm khi giữ Shift. */
    selectMany: (keys: string[], additive: boolean) =>
      setSelectedKeys((current) => (additive ? [...new Set([...current, ...keys])] : keys)),
    /** Shift + bấm: thêm / bớt một hình khỏi vùng chọn. */
    toggle: (key: string) =>
      setSelectedKeys((current) =>
        current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
      ),
    issues,
    stock,
    locks,
    changes: changeCount(draft),
    isChanged: (item: DraftItem) => isChanged(draft, item),
    isEditable: (item: DraftItem) =>
      group.length === 0 &&
      (item.id === null || (item.key === selectedKey && locks !== null && !locks.geometry)),
    change,
    warnBlockedMove,
    draw: (shape: DrawnShape) => {
      select(newKeyOf(draft));
      dispatch({ type: "draw", shape });
    },
    remove: () => {
      if (selected) {
        if (!locks || locks.remove) return;
        dispatch({ type: "remove", key: selected.key });
        return select(null);
      }
      // Nhóm: chỉ xoá hình đã biết không còn hàng và đủ quyền (BR-04), báo số hình bỏ qua
      const removable = groupRemovable(group, groupStock, can);
      if (removable.length > 0)
        dispatch({ type: "removeMany", keys: removable.map((item) => item.key) });
      const skipped = group.length - removable.length;
      if (skipped > 0) toast.warning(T.groupRemoveSkipped(skipped));
      // Giữ lại vùng chọn là các hình bị bỏ qua để người dùng thấy hình nào còn hàng
      setSelectedKeys(group.filter((item) => !removable.includes(item)).map((item) => item.key));
    },
    rotate: () =>
      changeSelected((item) =>
        item.kind === "boundary" ? item : { ...item, footprint: rotatedFootprint(item.footprint) },
      ),
    nudge: (dx: number, dy: number) =>
      changeSelected(
        (item) =>
          item.kind === "boundary"
            ? { ...item, ...nudgedLine(item, dx, dy) }
            : { ...item, footprint: nudgedFootprint(item.footprint, dx, dy, layout.warehouse) },
        `nudge:${selectedKey ?? ""}`,
      ),
    duplicate: () => void pasteCopies(chosen),
    cycle,
    canPaste: clipboard.length > 0,
    copy: () => {
      if (chosen.length > 0) setClipboard(chosen);
    },
    // Bản vừa dán làm nguồn cho lần dán sau → dán liên tiếp ra một dãy
    paste: () => {
      if (clipboard.length > 0) setClipboard(pasteCopies(clipboard));
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;
