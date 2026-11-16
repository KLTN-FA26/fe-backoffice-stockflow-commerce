import { describe, expect, it } from "vitest";

import { editableWithoutFile, figureRows, hasModel, modelFileStateOf, storedOf } from "./selectors";
import { CUP, cupDto, model3dWithFile } from "./test-fixtures";

const covered = { model3d: model3dWithFile() };

describe("selectors", () => {
  it("hasModel: only a configuration whose model3d has a file (model3d itself is always there)", () => {
    expect(hasModel(null)).toBe(false);
    expect(hasModel(cupDto())).toBe(false);
    expect(hasModel(cupDto(covered))).toBe(true);
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

  it("storedOf keeps what a save needs", () => {
    expect(storedOf(cupDto({ model3d: model3dWithFile() }))).toEqual({
      templateId: "tpl-1",
      version: 3,
      model: CUP,
      hasFile: true,
      surfaces: [{ printAreaCode: "BODY", meshName: "print:BODY" }],
    });
    expect(storedOf(cupDto()).hasFile).toBe(false);
  });
});

describe("modelFileStateOf: what the stored .glb allows", () => {
  const BODY = [{ printAreaCode: "BODY" as const, meshName: "print:BODY" }];
  it("ready: a file and every area on its print:<code> mesh; free edits and activation allowed", () => {
    const state = modelFileStateOf(cupDto(covered));
    expect(state).toEqual({ kind: "ready" });
    expect(editableWithoutFile(state)).toBe(true);
  });

  it("no-file: written before files were required; free edits only", () => {
    const state = modelFileStateOf(cupDto({ model3d: { ...cupDto().model3d, surfaces: BODY } }));
    expect(state).toEqual({ kind: "no-file" });
    expect(editableWithoutFile(state)).toBe(true);
  });

  it("no-model: no save without a file at all", () => {
    const state = modelFileStateOf(cupDto({ model: null, model3d: model3dWithFile() }));
    expect(state).toEqual({ kind: "no-model" });
    expect(editableWithoutFile(state)).toBe(false);
  });

  it("mapping-broken: a file, but a missing or misnamed mesh; every edit without a new file is blocked", () => {
    const missing = modelFileStateOf(cupDto({ model3d: { ...model3dWithFile(), surfaces: [] } }));
    expect(missing).toEqual({
      kind: "mapping-broken",
      faults: [{ kind: "missing", code: "BODY" }],
    });
    expect(editableWithoutFile(missing)).toBe(false);
    const misnamed = modelFileStateOf(
      cupDto({
        model3d: { ...model3dWithFile(), surfaces: [{ printAreaCode: "BODY", meshName: "Body" }] },
      }),
    );
    expect(misnamed).toEqual({
      kind: "mapping-broken",
      faults: [{ kind: "meshName", index: 0, code: "BODY" }],
    });
  });
});
