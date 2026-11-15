import { describe, expect, it } from "vitest";

import {
  defaultSurfaces,
  figureRows,
  hasModel,
  printAreasWithoutMesh,
  storedOf,
} from "./selectors";
import { CUP, cupDto, SHA_A } from "./test-fixtures";

const covered = {
  model3d: { url: "u", surfaces: [{ printAreaCode: "BODY" as const, meshName: "print:BODY" }] },
};

describe("selectors", () => {
  it("hasModel: only a configuration with a model3d", () => {
    expect(hasModel(null)).toBe(false);
    expect(hasModel(cupDto())).toBe(false);
    expect(hasModel(cupDto(covered))).toBe(true);
  });

  it("printAreasWithoutMesh: all areas without a model, none when covered, the missing ones otherwise", () => {
    expect(printAreasWithoutMesh(cupDto())).toEqual(["BODY"]);
    expect(printAreasWithoutMesh(cupDto(covered))).toEqual([]);
    const base = cupDto();
    const two = cupDto({
      printAreas: [
        { ...base.printAreas[0], code: "FRONT" },
        { ...base.printAreas[0], code: "BACK" },
      ],
      model3d: { url: "u", surfaces: [{ printAreaCode: "FRONT", meshName: "print:FRONT" }] },
    });
    expect(printAreasWithoutMesh(two)).toEqual(["BACK"]);
  });

  it("figureRows: the five measured figures of a cup, labelled, in mm", () => {
    expect(figureRows(CUP)).toEqual([
      { key: "topDiameterMm", label: "Đường kính miệng", value: 90, unit: "mm" },
      { key: "bottomDiameterMm", label: "Đường kính đáy", value: 60, unit: "mm" },
      { key: "heightMm", label: "Chiều cao", value: 110, unit: "mm" },
      { key: "bandTopOffsetMm", label: "Dải in cách miệng", value: 6, unit: "mm" },
      { key: "bandBottomOffsetMm", label: "Dải in cách đáy", value: 8, unit: "mm" },
    ]);
  });

  it("defaultSurfaces follows print:<code>; storedOf keeps what B-6 needs", () => {
    expect(defaultSurfaces(["FRONT", "BACK"])).toEqual([
      { printAreaCode: "FRONT", meshName: "print:FRONT" },
      { printAreaCode: "BACK", meshName: "print:BACK" },
    ]);
    expect(storedOf(cupDto({ modelFileChecksum: SHA_A }))).toEqual({
      templateId: "tpl-1",
      version: 3,
      model: CUP,
      modelFileChecksum: SHA_A,
    });
  });
});
