import { describe, expect, it } from "vitest";

import { blockedOrder, ftlLoad, pendingUnload } from "./__fixtures__/ftl-load";
import { loadShipment, parcel } from "./__fixtures__/load";
import { handoverBlockers } from "./handover-gate";

const loadWith = (loaded: boolean[], patch = {}) =>
  ftlLoad({
    status: "LOADING",
    shipments: [
      loadShipment(
        "SO-1-S1",
        loaded.map((done, i) => parcel(`PKG-SO-1-${i + 1}`, done)),
      ),
    ],
    ...patch,
  });

describe("handoverBlockers — vì sao nút bàn giao khoá (R7, BR-18)", () => {
  it("đủ kiện, không đơn bị chặn → không có lý do", () => {
    expect(handoverBlockers(loadWith([true, true]))).toEqual([]);
  });

  it("còn kiện chưa quét: số kiện và mã các kiện đó (S18-1, FE#291 U45)", () => {
    const blockers = handoverBlockers(loadWith([true, false, false]));
    expect(blockers).toEqual([
      { kind: "unscanned", count: 2, codes: ["PKG-SO-1-2", "PKG-SO-1-3"], more: 0 },
    ]);
  });

  it("liệt kê tối đa vài mã, phần còn lại ghi 'và N kiện khác'", () => {
    const blockers = handoverBlockers(loadWith(Array.from({ length: 9 }, () => false)));
    const [first] = blockers;
    expect(first).toMatchObject({ kind: "unscanned", count: 9, more: 4 });
    expect(first && "codes" in first ? first.codes : []).toHaveLength(5);
  });

  it("từng đơn chưa được phép đi là một lý do riêng, kèm cả khi đã quét đủ", () => {
    const order = blockedOrder();
    expect(handoverBlockers(loadWith([true], { handoverWarnings: [order] }))).toEqual([
      { kind: "order", order },
    ]);
  });

  it("chưa có lô và còn kiện phải dỡ cũng là lý do", () => {
    expect(handoverBlockers(ftlLoad({ shipments: [] }))).toEqual([{ kind: "empty" }]);
    expect(
      handoverBlockers(loadWith([true], { pendingUnloads: [pendingUnload()] })).map((b) => b.kind),
    ).toEqual(["unloadPending"]);
  });
});
