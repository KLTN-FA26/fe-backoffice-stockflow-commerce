import { describe, expect, it } from "vitest";

import { apiLoad, loadShipment, parcel } from "./__fixtures__/load";
import {
  findShipmentByCode,
  isLabelLoaded,
  isShipmentComplete,
  loadedLabelCodes,
  missingParcels,
  reconcileLoad,
} from "./selectors";

describe("reconcileLoad", () => {
  it("đếm kiện đã lên xe / cần lên xe và liệt kê lô còn thiếu", () => {
    const load = apiLoad();
    const result = reconcileLoad(load);
    expect(result).toMatchObject({ expected: 3, loaded: 1, progress: 33 });
    expect(result.incompleteShipments.map((s) => s.code)).toEqual(["SO-2-S1"]);
  });

  it("không có kiện → tiến độ 0; đủ kiện → 100", () => {
    expect(reconcileLoad(apiLoad({ shipments: [] })).progress).toBe(0);
    const full = apiLoad({ shipments: [loadShipment("A-S1", [parcel("P1", true)])] });
    expect(reconcileLoad(full).progress).toBe(100);
    expect(reconcileLoad(full).incompleteShipments).toEqual([]);
  });
});

describe("lô trên chuyến", () => {
  const [done, partial] = apiLoad().shipments;

  it("đủ khi mọi kiện đã lên xe; liệt kê kiện còn thiếu", () => {
    expect(done && isShipmentComplete(done)).toBe(true);
    expect(partial && isShipmentComplete(partial)).toBe(false);
    expect(partial && missingParcels(partial).map((p) => p.labelCode)).toEqual([
      "PKG-SO-2-1",
      "PKG-SO-2-2",
    ]);
  });

  it("lô không kiện không bao giờ 'đủ'", () => {
    expect(isShipmentComplete(loadShipment("E-S1", []))).toBe(false);
  });

  it("mã kiện đang trên xe và tra lô theo mã", () => {
    const load = apiLoad();
    expect(loadedLabelCodes(load)).toEqual(["PKG-SO-1-1"]);
    expect(findShipmentByCode(load, "SO-2-S1")?.shipmentId).toBe("shp-SO-2-S1");
    expect(findShipmentByCode(load, "NOPE")).toBeUndefined();
  });

  it("kiện đang trên xe tra theo mã nhãn không phân biệt hoa thường; kiện chưa quét thì không", () => {
    const load = apiLoad();
    expect(isLabelLoaded(load, "pkg-so-1-1")).toBe(true);
    expect(isLabelLoaded(load, "PKG-SO-2-1")).toBe(false);
    expect(isLabelLoaded(load, "NOPE")).toBe(false);
  });
});
