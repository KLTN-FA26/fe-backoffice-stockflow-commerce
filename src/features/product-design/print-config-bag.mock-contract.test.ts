/**
 * Contract test: the mock adapter treats a bag's glue flap and bottom fold as the BE does (origin/develop 3672ffb7):
 * a request or a stored template without them takes `BagModel`'s defaults, one out of range is 400
 * PRINT_CONFIG_INVALID naming its field (`PrintConfigRules.requireBag`, BE-12 `fieldErrors`).
 */
import { describe, expect, it } from "vitest";

import { api } from "@/lib/api/client";

import { apiError, EMPTY, plantTemplate, setUpMockBackend } from "./mock-backend-test-utils";
import { BAG_BODY, CUP_BODY } from "./test-fixtures";

setUpMockBackend();

const legacyPath = () =>
  `/products/${EMPTY.productId}/variants/${EMPTY.variantId}/customization-templates/tpl-legacy`;
const bag = BAG_BODY.model; // gusset 110 → default bottom fold 66

const body = (model: object) => ({
  name: CUP_BODY.name,
  minDpi: 300,
  colorMode: "CMYK",
  allowedFileFormats: ["image/png"],
  maxFileSizeMb: 50,
  version: 4,
  model: { ...bag, ...model },
  printAreas: BAG_BODY.printAreas,
  model3d: { surfaces: BAG_BODY.surfaces },
});

function plantBag() {
  if (bag.kind !== "parametric-bag") throw new Error("bag fixture");
  plantTemplate({
    model: bag,
    areas: BAG_BODY.printAreas,
    surfaces: BAG_BODY.surfaces,
    file: { url: "u", name: "bag.glb", sizeBytes: 16, checksum: "c".repeat(64) },
  });
}

describe("a bag's glue flap and bottom fold on the mock", () => {
  it("a stored bag without them is returned with the defaults, 20 and round2(0.6 × gusset)", async () => {
    plantBag();
    const { data } = await api.put<unknown>(legacyPath(), body({}));
    expect(data).toMatchObject({ model: { glueFlapMm: 20, bottomFoldMm: 66 } });
  });

  it("the values sent are kept", async () => {
    plantBag();
    const { data } = await api.put<unknown>(
      legacyPath(),
      body({ glueFlapMm: 15, bottomFoldMm: 110 }),
    );
    expect(data).toMatchObject({ model: { glueFlapMm: 15, bottomFoldMm: 110 } });
  });

  it.each([
    [{ glueFlapMm: 100.5 }, "model.glueFlapMm"],
    [{ glueFlapMm: -1 }, "model.glueFlapMm"],
    [{ bottomFoldMm: 110.01 }, "model.bottomFoldMm"],
    [{ bottomFoldMm: -0.5 }, "model.bottomFoldMm"],
  ])("%o is 400 PRINT_CONFIG_INVALID naming %s with the rule Range", async (model, field) => {
    plantBag();
    const error = await apiError(api.put<unknown>(legacyPath(), body(model)));
    expect([error.status, error.code]).toEqual([400, "PRINT_CONFIG_INVALID"]);
    expect(error.fieldErrorList?.map((e) => [e.field, e.code])).toEqual([[field, "Range"]]);
  });
});
