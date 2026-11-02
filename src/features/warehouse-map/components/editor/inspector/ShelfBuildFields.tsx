"use client";

import { UI_LABELS } from "@/constants";

import { BinGridFields } from "./BinGridFields";
import { CheckField, Section } from "./fields";
import { NumberField } from "./NumberField";

import type { DraftShelf, ShelfBuild } from "@/features/warehouse-map/draft";

const E = UI_LABELS.warehouseMap.editor;
const I = UI_LABELS.warehouseMap.edit.inspector;

/**
 * Tầng + bin tạo cùng kệ mới (docs 06 §4.1 bước 6–7): số tầng ≤ 20 (BR-15), cao mỗi tầng, có tự sinh
 * bin hay không (lưới ở `BinGridFields`). Chỉ có trước khi lưu.
 */
export function ShelfBuildFields({
  shelf,
  build,
  error,
  onChange,
}: {
  shelf: DraftShelf;
  build: ShelfBuild;
  error?: string;
  onChange: (build: ShelfBuild) => void;
}) {
  const setNumber = (key: "levelCount" | "levelHeight") => (value: number | null) => {
    if (value !== null) onChange({ ...build, [key]: value });
  };
  return (
    <Section title={I.build} error={error}>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id="build-levels"
          label={E.levelCount}
          integer
          value={build.levelCount}
          onCommit={setNumber("levelCount")}
        />
        <NumberField
          id="build-height"
          label={E.levelHeight}
          value={build.levelHeight}
          onCommit={setNumber("levelHeight")}
        />
      </div>
      <CheckField
        id="build-bins"
        label={E.generateBins}
        checked={build.generateBins}
        onChange={(generateBins) => onChange({ ...build, generateBins })}
      />
      {build.generateBins && build.levelCount > 0 && (
        <BinGridFields shelf={shelf} build={build} onChange={onChange} />
      )}
    </Section>
  );
}
