import { describe, expect, it } from "vitest";

import {
  filterPutawayTasks,
  freeVolumeText,
  freeWeightText,
  hasTextFilter,
  nextPendingTask,
  sortByLpn,
} from "../selectors";
import { task } from "./fixtures";

const EMPTY = { q: "", lpn: "", sku: "", location: "" };
const rows = [
  task({
    id: "a",
    lpn: "LPN-3",
    sku: "SKU-RED",
    lotNumber: "LOT-X",
    sourceLocationCode: "HCM-RCV01",
  }),
  task({ id: "b", lpn: "LPN-1", sku: "SKU-BLUE", lotNumber: null, sourceLocationCode: "HCM-QC01" }),
  task({
    id: "c",
    lpn: "LPN-2",
    sku: "SKU-RED",
    lotNumber: "LOT-Y",
    sourceLocationCode: "HCM-RCV01",
  }),
];

describe("filterPutawayTasks", () => {
  it("không có lọc → giữ mọi dòng", () => {
    expect(filterPutawayTasks(rows, EMPTY)).toHaveLength(3);
  });

  it("search chính quét LPN / SKU / lô / vị trí, không phân biệt hoa thường, bỏ khoảng trắng", () => {
    expect(filterPutawayTasks(rows, { ...EMPTY, q: "  lot-y " }).map((r) => r.id)).toEqual(["c"]);
    expect(filterPutawayTasks(rows, { ...EMPTY, q: "qc01" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("lọc trong cột kết hợp với nhau (AND)", () => {
    const out = filterPutawayTasks(rows, { ...EMPTY, sku: "red", location: "rcv" });
    expect(out.map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterPutawayTasks(rows, { ...EMPTY, sku: "red", lpn: "lpn-1" })).toEqual([]);
  });

  it("hasTextFilter chỉ bật khi có chữ thật", () => {
    expect(hasTextFilter(EMPTY)).toBe(false);
    expect(hasTextFilter({ ...EMPTY, q: "   " })).toBe(false);
    expect(hasTextFilter({ ...EMPTY, lpn: "1" })).toBe(true);
  });
});

describe("sortByLpn", () => {
  it("sắp theo LPN, không đổi mảng gốc", () => {
    expect(sortByLpn(rows).map((r) => r.lpn)).toEqual(["LPN-1", "LPN-2", "LPN-3"]);
    expect(rows[0]?.lpn).toBe("LPN-3");
  });
});

describe("định dạng chỗ còn trống", () => {
  it("null = không giới hạn (docs 05 BR-03)", () => {
    expect(freeVolumeText(null)).toBeNull();
    expect(freeWeightText(undefined)).toBeNull();
  });

  it("kiểu vi-VN, bỏ số 0 thừa", () => {
    expect(freeVolumeText(8.304)).toBe("8,304");
    expect(freeVolumeText(8.4)).toBe("8,4");
    expect(freeWeightText(240)).toBe("240");
  });
});

describe("nextPendingTask — nút 'Cất thùng tiếp theo (còn N)'", () => {
  it("lấy thùng chờ cất kế tiếp theo thứ tự LPN, bỏ thùng vừa cất và thùng đã xong", () => {
    const list = [
      task({ id: "a", lpn: "LPN-3", status: "PENDING" }),
      task({ id: "b", lpn: "LPN-1", status: "DONE" }),
      task({ id: "c", lpn: "LPN-2", status: "PENDING" }),
      task({ id: "d", lpn: "LPN-0", status: "PENDING" }),
    ];
    const next = nextPendingTask(list, "d");
    expect(next.task?.id).toBe("c");
    expect(next.remaining).toBe(2);
  });

  it("không còn thùng nào → task null, còn 0", () => {
    expect(nextPendingTask([task({ id: "a", status: "DONE" })], "a")).toEqual({
      task: null,
      remaining: 0,
    });
  });
});
