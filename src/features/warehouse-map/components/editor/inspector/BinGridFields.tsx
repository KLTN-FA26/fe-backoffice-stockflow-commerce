"use client";

import {
  BIN_NAMING_SCHEME_LABELS,
  BIN_NAMING_SCHEMES,
  BIN_TYPE_LABELS,
  BIN_TYPES,
  UI_LABELS,
} from "@/constants";

import { generatedBinSize } from "@/features/warehouse-map/selectors";

import { CheckField, ChoiceField } from "./fields";
import { NumberField } from "./NumberField";

import type { DraftShelf, ShelfBuild } from "@/features/warehouse-map/draft";

const E = UI_LABELS.warehouseMap.editor;

const namingOptions = BIN_NAMING_SCHEMES.map((value) => ({
  value,
  label: BIN_NAMING_SCHEME_LABELS[value],
}));
const binTypeOptions = BIN_TYPES.map((value) => ({ value, label: BIN_TYPE_LABELS[value] }));

/**
 * Lưới bin tự sinh cho mọi tầng của kệ mới (BR-14): hàng × cột ≤ 200, kích thước bin = cạnh kệ ÷ số
 * cột / hàng làm tròn xuống mm — xem trước ngay khi đổi cỡ kệ trên canvas.
 */
export function BinGridFields({
  shelf,
  build,
  onChange,
}: {
  shelf: DraftShelf;
  build: ShelfBuild;
  onChange: (build: ShelfBuild) => void;
}) {
  const set =
    <K extends keyof ShelfBuild>(key: K) =>
    (value: ShelfBuild[K]) =>
      onChange({ ...build, [key]: value });
  const setCount = (key: "rowCount" | "columnCount") => (value: number | null) => {
    if (value !== null) onChange({ ...build, [key]: value });
  };
  const { width, length } = shelf.footprint;
  const size = generatedBinSize(width, length, build.rowCount, build.columnCount);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id="build-rows"
          label={E.rowCount}
          integer
          value={build.rowCount}
          onCommit={setCount("rowCount")}
        />
        <NumberField
          id="build-columns"
          label={E.columnCount}
          integer
          value={build.columnCount}
          onCommit={setCount("columnCount")}
        />
      </div>
      <p className="text-ink-tertiary text-xs tabular-nums">
        {E.binPreview(build.rowCount, build.columnCount, String(size.width), String(size.length))}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ChoiceField
          id="build-naming"
          label={E.namingScheme}
          value={build.namingScheme}
          options={namingOptions}
          onChange={set("namingScheme")}
        />
        <ChoiceField
          id="build-bin-type"
          label={E.binType}
          value={build.binType}
          options={binTypeOptions}
          onChange={set("binType")}
        />
        <NumberField
          id="build-capacity"
          label={E.capacityUnits}
          integer
          optional
          value={build.capacityUnits}
          onCommit={set("capacityUnits")}
        />
        <NumberField
          id="build-weight"
          label={E.maxWeight}
          optional
          value={build.maxWeight}
          onCommit={set("maxWeight")}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <CheckField
          id="build-pickable"
          label={E.pickable}
          checked={build.pickable}
          onChange={set("pickable")}
        />
        <CheckField
          id="build-putaway"
          label={E.putawayTarget}
          checked={build.putawayTarget}
          onChange={set("putawayTarget")}
        />
      </div>
    </>
  );
}
