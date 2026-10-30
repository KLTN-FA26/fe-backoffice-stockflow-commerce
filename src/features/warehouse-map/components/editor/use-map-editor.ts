"use client";

import { useReducer, useState } from "react";

import { changeCount, isChanged } from "@/features/warehouse-map/draft";
import { duplicatedItem } from "@/features/warehouse-map/draft-duplicate";
import { newKeyOf } from "@/features/warehouse-map/draft-edit";
import {
  nudgedFootprint,
  nudgedLine,
  rotatedFootprint,
} from "@/features/warehouse-map/draft-geometry";
import { historyFromLayout, historyReducer } from "@/features/warehouse-map/draft-history";
import { validateDraft } from "@/features/warehouse-map/draft-rules";
import { placeLocks } from "@/features/warehouse-map/lifecycle";
import { usePlaceHasStock } from "@/features/warehouse-map/queries";

import type { DraftItem } from "@/features/warehouse-map/draft";
import type { DraftTool, DrawnShape } from "@/features/warehouse-map/draft-edit";
import type { EditPermissions, StockState } from "@/features/warehouse-map/lifecycle";
import type { WarehouseLayout } from "@/features/warehouse-map/types";

/** Vị trí tồn cần hỏi cho hình đang chọn — hình mới, tường / cửa, khu NON_STORAGE không có tồn (BR-11). */
function stockProbe(warehouse: WarehouseLayout["warehouse"], item: DraftItem | null) {
  if (!item || item.id === null || item.kind === "boundary") return null;
  if (item.kind === "area" && !item.wasStorage) return null;
  return {
    warehouseId: warehouse.id,
    locationCode: `${warehouse.prefix}-${item.code}`,
    exact: item.kind === "area",
  };
}

/**
 * State của chế độ sửa: bản nháp có lịch sử hoàn tác (reducer thuần), công cụ, hình đang chọn, lỗi luật,
 * tồn của hình đang chọn và phần được sửa (`placeLocks`). Hình đã lưu chỉ kéo được khi đang chọn và đã
 * biết không còn hàng.
 */
export function useMapEditor(layout: WarehouseLayout, can: EditPermissions) {
  const [history, dispatch] = useReducer(historyReducer, layout, historyFromLayout);
  const draft = history.present;
  const [tool, setTool] = useState<DraftTool>("select");
  const [selectedKey, select] = useState<string | null>(null);
  /** Hình đã sao chép (Ctrl+C) — chỉ trong phiên sửa này, không ghi vào clipboard hệ điều hành. */
  const [clipboard, setClipboard] = useState<DraftItem | null>(null);
  const issues = validateDraft(draft, layout.warehouse);
  const selected = draft.items.find((item) => item.key === selectedKey) ?? null;
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
  const locks = selected ? placeLocks(selected, stock, can) : null;

  /** `tag`: thao tác liền nhau cùng tag gộp thành một bước hoàn tác (gõ trong modal, dời bằng phím). */
  const change = (key: string, apply: (item: DraftItem) => DraftItem, tag?: string) =>
    dispatch({ type: "update", key, apply, tag });
  const changeSelected = (apply: (item: DraftItem) => DraftItem, tag?: string) => {
    if (selected && locks && !locks.geometry) change(selected.key, apply, tag);
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
    select,
    issues,
    stock,
    locks,
    changes: changeCount(draft),
    isChanged: (item: DraftItem) => isChanged(draft, item),
    isEditable: (item: DraftItem) =>
      item.id === null || (item.key === selectedKey && locks !== null && !locks.geometry),
    change,
    draw: (shape: DrawnShape) => {
      select(newKeyOf(draft));
      dispatch({ type: "draw", shape });
    },
    remove: () => {
      if (!selected || !locks || locks.remove) return;
      dispatch({ type: "remove", key: selected.key });
      select(null);
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
    duplicate: () => {
      if (!selected) return;
      select(newKeyOf(draft));
      dispatch({ type: "duplicate", key: selected.key });
    },
    cycle,
    canPaste: clipboard !== null,
    copy: () => {
      if (selected) setClipboard(selected);
    },
    paste: () => {
      if (!clipboard) return;
      const key = newKeyOf(draft);
      dispatch({ type: "paste", item: clipboard });
      select(key);
      // Bản vừa dán (tính y như reducer) làm nguồn cho lần dán sau → dán liên tiếp ra một dãy
      setClipboard(duplicatedItem(draft, clipboard, key));
    },
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;
