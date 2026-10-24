import { describe, expect, it } from "vitest";

import { PLACEMENT_RULES } from "./load-planning";
import { PLACEMENT_RULE_LABELS } from "./labels-load-planning";

describe("PLACEMENT_RULES (codes fixed by the BE solver)", () => {
  it("lists exactly the nine rule codes (BE solver + the orientation integrity check)", () => {
    expect([...PLACEMENT_RULES]).toEqual([
      "OUT_OF_BOUNDS",
      "OVERLAP",
      "UNSUPPORTED",
      "OVERWEIGHT",
      "ROTATION_NOT_ALLOWED",
      "GUSSET",
      "DOOR",
      "KIT_SPLIT",
      "ORIENTATION_MISMATCH",
    ]);
  });

  it("has a Vietnamese label for every rule, and the support label quotes the 98% threshold", () => {
    for (const rule of PLACEMENT_RULES)
      expect(PLACEMENT_RULE_LABELS[rule].length).toBeGreaterThan(5);
    expect(PLACEMENT_RULE_LABELS.UNSUPPORTED).toContain("98%");
  });
});
