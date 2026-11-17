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

  it("quét theo LPN trên nhãn giao hàng cũng tính là đã lên xe (không phân biệt hoa thường); mã nhãn vẫn khớp", () => {
    const load = apiLoad();
    const withLpn = {
      ...load,
      shipments: [
        loadShipment("LPN-S1", [
          parcel("PKG-SO-9-1", true, { lpn: "LPN-20261117-000008" }),
          parcel("PKG-SO-9-2", false, { lpn: "LPN-20261117-000009" }),
        ]),
      ],
    };
    expect(isLabelLoaded(withLpn, "LPN-20261117-000008")).toBe(true);
    expect(isLabelLoaded(withLpn, "lpn-20261117-000008")).toBe(true);
    expect(isLabelLoaded(withLpn, "PKG-SO-9-1")).toBe(true);
    // LPN của kiện chưa lên xe không được tính
    expect(isLabelLoaded(withLpn, "LPN-20261117-000009")).toBe(false);
    expect(loadedLabelCodes(withLpn)).toEqual(["PKG-SO-9-1", "LPN-20261117-000008"]);
  });

  it("BE cũ không có lpn (hoặc lpn null) → chỉ khớp theo mã nhãn, không lỗi", () => {
    const old = {
      shipments: [
        loadShipment("OLD-S1", [
          parcel("PKG-SO-8-1", true),
          parcel("PKG-SO-8-2", true, { lpn: null }),
        ]),
      ],
    };
    expect(isLabelLoaded(old, "PKG-SO-8-2")).toBe(true);
    expect(isLabelLoaded(old, "LPN-20261117-000008")).toBe(false);
    expect(loadedLabelCodes(old)).toEqual(["PKG-SO-8-1", "PKG-SO-8-2"]);
  });
});
