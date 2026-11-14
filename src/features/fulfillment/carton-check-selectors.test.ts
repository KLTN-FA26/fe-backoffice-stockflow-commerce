import { describe, expect, it } from "vitest";

import {
  LINE_A_ID,
  allLabeledSession,
  apiCarton,
  apiSession,
  checkedCarton,
  labeledCarton,
  startedSession,
} from "./__fixtures__/carton-check";
import { toCartonCheckSession } from "./carton-check-api";
import {
  cartonProgress,
  completionReadiness,
  findCarton,
  removedCartons,
  sortedCartons,
} from "./carton-check-selectors";

import type { CartonCheckSessionDto } from "./carton-check-types";

const session = (dto: CartonCheckSessionDto) => toCartonCheckSession(dto);

describe("completionReadiness — docs 08 §4.4 bước 8", () => {
  it("(1) còn thùng To Check / Checked → chưa hoàn tất được (BE PACKING_INCOMPLETE)", () => {
    const ready = completionReadiness(
      session(
        startedSession({
          cartons: [labeledCarton(), checkedCarton({ packageNo: 2, lpn: "LPN000002" })],
        }),
      ),
    );
    expect(ready.pending.map((c) => c.lpn)).toEqual(["LPN000002"]);
    expect(ready.canFull).toBe(false);
    expect(ready.canPartial).toBe(false);
  });

  it("(2) chưa có thùng Labeled nào chưa vào shipment → không có gì để giao (BE PACK_NOTHING_TO_SHIP)", () => {
    const ready = completionReadiness(
      session(
        startedSession({
          cartons: [apiCarton({ status: "REMOVED", removalReason: "DAMAGED" })],
        }),
      ),
    );
    expect(ready.pending).toEqual([]);
    expect(ready.toShip).toEqual([]);
    expect(ready.canFull).toBe(false);
    expect(ready.canPartial).toBe(false);
  });

  it("(3) mọi thùng Labeled và đủ số cái → hoàn tất đủ", () => {
    const ready = completionReadiness(session(allLabeledSession()));
    expect(ready.toShip).toHaveLength(2);
    expect(ready.missing).toEqual([]);
    expect(ready.canFull).toBe(true);
    expect(ready.canPartial).toBe(false);
  });

  it("(3) thiếu số cái (thùng bị loại) → chỉ giao được một phần", () => {
    const base = allLabeledSession();
    const ready = completionReadiness(
      session({
        ...base,
        lines: base.lines.map((line) =>
          line.orderLineId === LINE_A_ID
            ? { ...line, labeledCartons: 0, removedCartons: 1, labeledUnits: 0, missingUnits: 10 }
            : line,
        ),
        cartons: [
          apiCarton({ status: "REMOVED", removalReason: "DAMAGED" }),
          ...base.cartons.slice(1),
        ],
      }),
    );
    expect(ready.missing.map((line) => line.sku)).toEqual(["TEE-BLK-M"]);
    expect(ready.canFull).toBe(false);
    expect(ready.canPartial).toBe(true);
  });

  it("thùng đã vào shipment không tính vào shipment kế tiếp", () => {
    const ready = completionReadiness(
      session(
        startedSession({
          cartons: [labeledCarton({ shipmentId: "s-1" })],
          lines: apiSession().lines.map((line) => ({ ...line, wantedUnits: 0 })),
        }),
      ),
    );
    expect(ready.toShip).toEqual([]);
    expect(ready.canFull).toBe(false);
  });

  it("dòng không còn cần (wantedUnits = 0) không bị tính thiếu", () => {
    const base = allLabeledSession();
    const ready = completionReadiness(
      session({
        ...base,
        lines: base.lines.map((line) => ({ ...line, wantedUnits: 0, labeledUnits: 0 })),
      }),
    );
    expect(ready.missing).toEqual([]);
  });
});

describe("cartonProgress / findCarton / removedCartons / sortedCartons", () => {
  const mixed = session(
    startedSession({
      cartons: [
        labeledCarton({ packageNo: 3, lpn: "LPN000003" }),
        checkedCarton({ packageNo: 2, lpn: "LPN000002" }),
        apiCarton({ packageNo: 1, lpn: "LPN000001" }),
        apiCarton({ packageNo: 4, lpn: "LPN000004", status: "REMOVED", removalReason: "DAMAGED" }),
      ],
    }),
  );

  it("đếm giống hàng chờ BE: đã quét gồm cả Labeled; thùng Removed tách riêng", () => {
    expect(cartonProgress(mixed)).toEqual({ total: 3, checked: 2, labeled: 1, removed: 1 });
  });

  it("tìm thùng theo LPN không phân biệt hoa thường", () => {
    expect(findCarton(mixed, " lpn000002 ")?.packageNo).toBe(2);
    expect(findCarton(mixed, "LPN999999")).toBeUndefined();
  });

  it("thùng xếp theo số thứ tự; thùng đã loại liệt kê riêng", () => {
    expect(sortedCartons(mixed).map((c) => c.packageNo)).toEqual([1, 2, 3, 4]);
    expect(removedCartons(mixed).map((c) => c.lpn)).toEqual(["LPN000004"]);
  });
});
