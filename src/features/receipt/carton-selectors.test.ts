import { describe, expect, it } from "vitest";

import { cartonLine, cartonPackage } from "./__fixtures__/receipt";
import { liveCartons, liveSelection } from "./carton-selectors";

describe("thùng của dòng", () => {
  it("liveCartons: RECEIVING / IN_STOCK — thùng in nhãn được", () => {
    const line = cartonLine({
      packages: [
        cartonPackage({ status: "IN_STOCK" }),
        cartonPackage({ lpn: "LPN-20261024-000002", status: "CONSUMED" }),
        cartonPackage({ lpn: "LPN-20261024-000003", status: "LOST" }),
        cartonPackage({ lpn: "LPN-20261024-000004", status: "RECEIVING" }),
      ],
    });
    expect(liveCartons(line).map((p) => p.lpn)).toEqual([
      "LPN-20261024-000001",
      "LPN-20261024-000004",
    ]);
  });
});

describe("liveSelection — chỉ in lại thùng còn hiệu lực", () => {
  it("bỏ LPN đã tick nhưng nay đã dùng hết / không còn trên dòng", () => {
    const line = cartonLine({
      packages: [
        cartonPackage({ status: "IN_STOCK" }),
        cartonPackage({ lpn: "LPN-20261024-000002", status: "CONSUMED" }),
      ],
    });
    const ticked = new Set(["LPN-20261024-000001", "LPN-20261024-000002", "LPN-GONE"]);
    expect(liveSelection(ticked, line)).toEqual(["LPN-20261024-000001"]);
  });
});
