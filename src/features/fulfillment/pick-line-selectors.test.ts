import { describe, expect, it } from "vitest";

import { PICK_LINE_LABELS as L } from "@/constants";

import { PICK_LINE_2, apiPickLines } from "./__fixtures__/pick-lines";
import { apiTaskLines } from "./__fixtures__/task";
import { toPickLine } from "./pick-line-api";
import {
  awaitingPutBackCount,
  itemOptions,
  linesComplete,
  needsLinePlanning,
  nextOpenLine,
  openLineCount,
  pickIncompleteReason,
  pickLocationOptions,
  pickProgress,
  printLineCount,
  shortLineCount,
} from "./pick-line-selectors";

import type { PickLine } from "./types";

const lines = (): PickLine[] => apiPickLines().map(toPickLine);
const withStatus = (statuses: PickLine["status"][]) =>
  lines().map((line, index) => ({ ...line, status: statuses[index] ?? line.status }));

describe("pick-line selectors", () => {
  it("pickProgress đếm dòng đã lấy / tổng, không tính dòng đã huỷ (dòng thiếu được phân bổ lại)", () => {
    expect(pickProgress(withStatus(["Picked", "Open", "Open"]))).toEqual({ picked: 1, total: 3 });
    expect(pickProgress(withStatus(["Picked", "Cancelled", "Open"]))).toEqual({
      picked: 1,
      total: 2,
    });
  });

  it("nextOpenLine: dòng Open có sequenceNo nhỏ nhất, bỏ qua dòng đã lấy / thiếu", () => {
    const shuffled = [...withStatus(["Picked", "Open", "Open"])].reverse();
    expect(nextOpenLine(shuffled)?.lineId).toBe(PICK_LINE_2);
    expect(nextOpenLine(withStatus(["Short", "Open", "Picked"]))?.lineId).toBe(PICK_LINE_2);
    expect(nextOpenLine(withStatus(["Picked", "Picked", "Picked"]))).toBeUndefined();
  });

  it("itemOptions: SKU + barcode của các dòng, bỏ trùng; dòng không barcode chỉ có SKU", () => {
    const options = itemOptions([...lines(), lines()[0] as PickLine]);
    expect(options).toEqual([
      { value: "TEE-BLK-M", label: "TEE-BLK-M" },
      { value: "8935000000017", label: "8935000000017 · TEE-BLK-M" },
      { value: "MUG-WHT", label: "MUG-WHT" },
      { value: "CAP-RED", label: "CAP-RED" },
      { value: "8935000000031", label: "8935000000031 · CAP-RED" },
    ]);
  });

  it("pickLocationOptions: hợp mã layout (mọi loại, kể cả không dùng được) với vị trí các dòng", () => {
    const options = pickLocationOptions(
      [
        { locationCode: "HN-Z-99", kind: "AREA", usable: true },
        { locationCode: "HN-A01-01-01-A", kind: "BIN", usable: false },
      ],
      lines(),
    );
    expect(options.map((option) => option.value)).toEqual([
      "HN-A01-01-01-A",
      "HN-A01-01-02-A",
      "HN-A02-02-01-B",
      "HN-Z-99",
    ]);
  });

  it("pickLocationOptions: không tải được layout → vẫn có vị trí của các dòng", () => {
    expect(pickLocationOptions(undefined, lines()).map((option) => option.value)).toEqual([
      "HN-A01-01-01-A",
      "HN-A01-01-02-A",
      "HN-A02-02-01-B",
    ]);
  });

  it("linesComplete: mọi dòng Picked hoặc Cancelled; còn Open / Short → false; không có dòng → true", () => {
    expect(linesComplete([])).toBe(true);
    expect(linesComplete(withStatus(["Picked", "Cancelled", "Picked"]))).toBe(true);
    expect(linesComplete(withStatus(["Picked", "Open", "Picked"]))).toBe(false);
    expect(linesComplete(withStatus(["Picked", "Short", "Picked"]))).toBe(false);
  });

  it("pickIncompleteReason: lỗi tải → nhắc thử lại; còn dòng mở / thiếu → đếm; đủ dòng → không có", () => {
    expect(pickIncompleteReason(undefined, true)).toBe(L.linesUnavailable);
    expect(pickIncompleteReason(undefined, false)).toBeUndefined();
    expect(pickIncompleteReason(withStatus(["Picked", "Open", "Short"]), false)).toBe(
      L.openLeft(1),
    );
    expect(pickIncompleteReason(withStatus(["Picked", "Short", "Cancelled"]), false)).toBe(
      L.shortLeft(1),
    );
    expect(
      pickIncompleteReason(withStatus(["Picked", "Cancelled", "Picked"]), false),
    ).toBeUndefined();
  });

  it("task Picking chưa có dòng mà đơn còn dòng hàng sẵn → cần lập dòng, chưa đủ để hoàn tất (BE PICK_LINES_INCOMPLETE)", () => {
    const picking = { pickStatus: "Picking" as const, lines: apiTaskLines };
    expect(needsLinePlanning(picking, [])).toBe(true);
    expect(linesComplete([], picking)).toBe(false);
    expect(pickIncompleteReason([], false, picking)).toBe(L.planLinesFirst);
    // Có dòng rồi, chưa bắt đầu, hoặc đơn chỉ có dòng in → không cần lập
    expect(needsLinePlanning(picking, lines())).toBe(false);
    expect(needsLinePlanning({ ...picking, pickStatus: "Pending" }, [])).toBe(false);
    const printOnly = { ...picking, lines: apiTaskLines.filter((line) => line.printLine) };
    expect(needsLinePlanning(printOnly, [])).toBe(false);
    expect(linesComplete([], printOnly)).toBe(true);
  });

  it("openLineCount / shortLineCount", () => {
    const mixed = withStatus(["Open", "Short", "Open"]);
    expect(openLineCount(mixed)).toBe(2);
    expect(shortLineCount(mixed)).toBe(1);
  });

  it("printLineCount đếm dòng in trong task.lines", () => {
    expect(printLineCount({ lines: apiTaskLines })).toBe(1);
    expect(printLineCount({})).toBe(0);
  });

  it("awaitingPutBackCount: chỉ đếm dòng Picked khi task Cancelled", () => {
    const picked = withStatus(["Picked", "Cancelled", "Cancelled"]);
    expect(awaitingPutBackCount({ pickStatus: "Cancelled" }, picked)).toBe(1);
    expect(awaitingPutBackCount({ pickStatus: "Picked" }, picked)).toBe(0);
  });
});
