import { describe, expect, it } from "vitest";

import { PICK_LINE_LABELS as L } from "@/constants";

import { PICK_LINE_2, apiPickLines } from "./__fixtures__/pick-lines";
import { apiTaskLines } from "./__fixtures__/task";
import { toPickLine } from "./pick-line-api";
import {
  awaitingPutBackCount,
  byWalkingOrder,
  defaultPutBackLocation,
  linesComplete,
  needsLinePlanning,
  nextOpenLine,
  openLineCount,
  pickIncompleteReason,
  pickLocationOptions,
  pickProgress,
  putBackLocationOptions,
  shortLineCount,
  stagingAreaOptions,
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

  it("pickProgress: thùng đã về khu chờ xuất (Staged) cũng tính là đã lấy", () => {
    expect(pickProgress(withStatus(["Staged", "Staged", "Open"]))).toEqual({ picked: 2, total: 3 });
  });

  it("nextOpenLine: dòng Open đứng đầu lộ trình (mã vị trí rồi SKU), bỏ qua dòng đã lấy / thiếu", () => {
    const shuffled = [...withStatus(["Picked", "Open", "Open"])].reverse();
    expect(nextOpenLine(shuffled)?.lineId).toBe(PICK_LINE_2);
    expect(nextOpenLine(withStatus(["Short", "Open", "Picked"]))?.lineId).toBe(PICK_LINE_2);
    expect(nextOpenLine(withStatus(["Picked", "Picked", "Picked"]))).toBeUndefined();
  });

  it("byWalkingOrder: sắp theo mã vị trí rồi SKU (docs 07 §4.1 bước 2) — dòng phân bổ lại thêm cuối vẫn vào đúng chỗ", () => {
    const [first, second, third] = lines();
    // Dòng mới do phân bổ lại: sequenceNo lớn nhất nhưng bin đứng giữa lộ trình
    const reallocated = {
      ...first,
      lineId: "r",
      sequenceNo: 9,
      locationCode: "HN-A01-01-02-A",
      sku: "AAA",
    } as PickLine;
    const sorted = [third, reallocated, second, first] as PickLine[];
    expect(sorted.sort(byWalkingOrder).map((line) => [line.locationCode, line.sku])).toEqual([
      ["HN-A01-01-01-A", "TEE-BLK-M"],
      ["HN-A01-01-02-A", "AAA"],
      ["HN-A01-01-02-A", "MUG-WHT"],
      ["HN-A02-02-01-B", "CAP-RED"],
    ]);
    // Dòng Open đầu tiên theo lộ trình, không theo sequenceNo
    expect(nextOpenLine([third, reallocated] as PickLine[])?.lineId).toBe("r");
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

  it("linesComplete: mọi dòng Picked / Staged / Cancelled; còn Open / Short → false; không có dòng → true", () => {
    expect(linesComplete([])).toBe(true);
    expect(linesComplete(withStatus(["Picked", "Cancelled", "Picked"]))).toBe(true);
    // Task đích STAGING: mọi thùng đã về khu chờ xuất là đủ để hoàn tất (task → Staged)
    expect(linesComplete(withStatus(["Staged", "Staged", "Cancelled"]))).toBe(true);
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

  it("awaitingPutBackCount: đếm dòng Picked / Staged khi task Cancelled (docs 07 §4.5 bước 13)", () => {
    const picked = withStatus(["Picked", "Staged", "Cancelled"]);
    expect(awaitingPutBackCount({ pickStatus: "Cancelled" }, picked)).toBe(2);
    expect(awaitingPutBackCount({ pickStatus: "Picked" }, picked)).toBe(0);
  });
});

describe("vị trí cất lại thùng — BE PickList.putBack: bin đang dùng được; thùng cách ly vào khu QUARANTINE", () => {
  const LOCATIONS = [
    { locationCode: "HN-A01-01-01-A", kind: "BIN" as const, usable: true },
    { locationCode: "HN-A01-01-02-A", kind: "BIN" as const, usable: false },
    { locationCode: "HN-STAGE-01", kind: "AREA" as const, usable: true, areaType: "STAGING" },
    { locationCode: "HN-QC-01", kind: "AREA" as const, usable: true, areaType: "QUARANTINE" },
    { locationCode: "HN-QC-02", kind: "AREA" as const, usable: false, areaType: "QUARANTINE" },
  ];

  it("putBackLocationOptions bỏ khu chứa và bin không dùng được", () => {
    expect(putBackLocationOptions(LOCATIONS).map((o) => o.value)).toEqual(["HN-A01-01-01-A"]);
    expect(putBackLocationOptions(undefined)).toEqual([]);
  });

  it("thùng quarantine: chỉ khu QUARANTINE đang dùng được, không có bin", () => {
    expect(putBackLocationOptions(LOCATIONS, true).map((o) => o.value)).toEqual(["HN-QC-01"]);
  });

  it("defaultPutBackLocation: bin cũ còn dùng được → chọn sẵn; không thì để trống (kể cả thùng đang ở khu chờ xuất)", () => {
    expect(defaultPutBackLocation("HN-A01-01-01-A", LOCATIONS)).toBe("HN-A01-01-01-A");
    expect(defaultPutBackLocation("HN-A01-01-02-A", LOCATIONS)).toBe("");
    expect(defaultPutBackLocation("HN-STAGE-01", LOCATIONS)).toBe("");
  });

  it("thùng quarantine: kho chỉ có một khu cách ly dùng được → chọn sẵn", () => {
    expect(defaultPutBackLocation("HN-A01-01-01-A", LOCATIONS, true)).toBe("HN-QC-01");
    expect(
      defaultPutBackLocation(
        "HN-A01-01-01-A",
        [
          ...LOCATIONS,
          { locationCode: "HN-QC-03", kind: "AREA" as const, usable: true, areaType: "QUARANTINE" },
        ],
        true,
      ),
    ).toBe("");
  });

  it("stagingAreaOptions: chỉ khu STAGING đang dùng được (đích STAGING khi tạo task)", () => {
    expect(stagingAreaOptions(LOCATIONS).map((o) => o.value)).toEqual(["HN-STAGE-01"]);
    expect(stagingAreaOptions(undefined)).toEqual([]);
  });
});
