import { describe, expect, it } from "vitest";

import { apiLoad, loadShipment, parcel, shipmentRow } from "./__fixtures__/load";
import {
  findShipmentByCode,
  isShipmentComplete,
  loadedLabelCodes,
  missingParcels,
  reconcileLoad,
  summarizeSelection,
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
});

describe("summarizeSelection — lô đã chọn để mở chuyến", () => {
  it("cùng kho, hãng chung → dùng cho chuyến", () => {
    const rows = [
      shipmentRow({ carrierId: "c1" }),
      shipmentRow({ shipmentId: "s2", carrierId: "c1" }),
    ];
    expect(summarizeSelection(rows)).toEqual({
      warehouseId: "wh-hcm",
      mixedWarehouses: false,
      carrierId: "c1",
      mixedCarriers: false,
    });
  });

  it("khác kho hoặc khác hãng được báo; chưa gán hãng thì không ép hãng", () => {
    const mixed = summarizeSelection([
      shipmentRow({ carrierId: "c1" }),
      shipmentRow({ shipmentId: "s2", warehouseId: "wh-hn", carrierId: "c2" }),
    ]);
    expect(mixed).toMatchObject({ warehouseId: null, mixedWarehouses: true, mixedCarriers: true });
    expect(summarizeSelection([shipmentRow()]).carrierId).toBeNull();
    expect(summarizeSelection([])).toMatchObject({ warehouseId: null, mixedWarehouses: false });
  });
});
