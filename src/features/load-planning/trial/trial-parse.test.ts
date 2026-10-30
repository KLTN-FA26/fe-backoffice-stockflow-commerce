import { describe, expect, it } from "vitest";

import { parseTrialRows, TrialParseError } from "./trial-parse";

import type { TrialRow } from "./trial-parse";

/** Bảng EasyCargo như docstring của `parsers.py`: tiêu đề, dòng đơn vị, rồi các dòng hàng. */
const HEADER: TrialRow = [
  "Group",
  "Description",
  "Pieces",
  "Length",
  "Width",
  "Height",
  "Total weight",
  "Stackable",
  "Tiltable",
  "Rotable",
];
const CM: TrialRow = [
  null,
  null,
  null,
  "centimeters",
  null,
  null,
  "kilograms",
  "Y/N",
  "Y/N",
  "Y/N",
];
const SAMPLE: TrialRow = ["VIS-1", "SW1701-1 5HK2394A", 10, 90, 72, 131, 1, "Y", "Y", "Y"];

const table = (...rows: TrialRow[]) => [["EasyCargo import template"], HEADER, CM, ...rows];

describe("parseTrialRows — ánh xạ cột như parsers.py", () => {
  it("Length → dọc xe, Width, Height; Group → group; Description → name; xentimét ra mm", () => {
    const { lines, summary } = parseTrialRows(table(SAMPLE));
    expect(lines).toEqual([
      {
        name: "SW1701-1 5HK2394A",
        group: "VIS-1",
        lengthMm: 900,
        widthMm: 720,
        heightMm: 1310,
        quantity: 10,
        rotatable: true,
        sourceRow: 4,
      },
    ]);
    expect(summary).toEqual({ rows: 1, groups: 1, totalPieces: 10, unitLabel: "xentimét" });
  });

  it("tìm cột theo TÊN, không theo vị trí: cột đảo chỗ, thừa cột, tiêu đề có xuống dòng / hoa thường", () => {
    const rows: TrialRow[] = [
      ["Ghi chú", "HEIGHT\n", " Width ", "LENGTH", "Qty", "Name", "Rotatable"],
      [null, "mm", "mm", "mm", null, null, null],
      ["x", 30, 40, 60, 2, "Hộp A", "no"],
    ];
    const { lines } = parseTrialRows(rows);
    expect(lines[0]).toMatchObject({
      name: "Hộp A",
      lengthMm: 60,
      widthMm: 40,
      heightMm: 30,
      quantity: 2,
      rotatable: false,
    });
  });

  it("bí danh khớp theo tiền tố, cột đầu tiên khớp thắng", () => {
    const rows: TrialRow[] = [
      ["Pieces", "Pcs", "Length (cm)", "Width", "Height"],
      [null, null, "centimeters", null, null],
      [3, 99, 10, 20, 30],
    ];
    const { lines } = parseTrialRows(rows);
    expect(lines[0]).toMatchObject({ quantity: 3, lengthMm: 100, widthMm: 200, heightMm: 300 });
  });

  it("dòng tiêu đề không phải dòng đầu: bỏ các dòng tiêu đề trang phía trên; số dòng đếm từ 1 trong file", () => {
    const { lines } = parseTrialRows(table(SAMPLE));
    expect(lines[0]?.sourceRow).toBe(4);
  });

  it("Rotable: ô trống = xoay được; n / no / false / 0 / f / không / khong = không; còn lại = có", () => {
    const rot = (value: string | number | boolean | null) => {
      const row: TrialRow = ["", "x", 1, 1, 1, 1, null, null, null, value];
      return parseTrialRows(table(row)).lines[0]?.rotatable;
    };
    expect(rot(null)).toBe(true);
    expect(rot("")).toBe(true);
    for (const no of ["N", "no", "False", "0", "f", "Không", "KHONG", false, 0])
      expect(rot(no)).toBe(false);
    for (const yes of ["Y", "yes", "true", 1, true]) expect(rot(yes)).toBe(true);
  });
});

describe("parseTrialRows — dòng đơn vị", () => {
  const withUnit = (unit: string | null, value: number) =>
    parseTrialRows([HEADER, [null, null, null, unit], ["", "x", 1, value, value, value]]).lines[0]
      ?.lengthMm;

  it("milimét / xentimét / mét / inch; không có đơn vị thì xentimét", () => {
    expect(withUnit("millimeters", 7)).toBe(7);
    expect(withUnit("mm", 7)).toBe(7);
    expect(withUnit("centimeters", 7)).toBe(70);
    expect(withUnit("Meters", 2)).toBe(2000);
    expect(withUnit("inches", 2)).toBe(51);
    expect(withUnit('"', 10)).toBe(254);
    expect(withUnit(null, 7)).toBe(70);
    expect(withUnit("???", 7)).toBe(70);
  });

  it("đơn vị lấy từ MỌI ô của dòng ngay dưới tiêu đề; thiếu dòng đó thì xentimét", () => {
    const rows: TrialRow[] = [["Pieces", "Length", "Width", "Height"]];
    expect(() => parseTrialRows(rows)).toThrow(TrialParseError);
    const only = parseTrialRows([HEADER, ["", "x", 1, 1, 1, 1]]);
    expect(only.lines[0]?.lengthMm).toBe(10);
    expect(only.summary.unitLabel).toBe("xentimét");
  });

  it("kích thước làm tròn tới mm (BE nhận mm nguyên), tối thiểu 1 mm", () => {
    const r = parseTrialRows([HEADER, [null, null, null, "inches"], ["", "x", 1, 3, 0.01, 1.5]]);
    expect(r.lines[0]).toMatchObject({ lengthMm: 76, widthMm: 1, heightMm: 38 });
  });
});

describe("parseTrialRows — dòng bị bỏ", () => {
  it("dòng đơn vị và dòng trống bị bỏ IM LẶNG (thiếu kích thước)", () => {
    const { lines, skipped } = parseTrialRows(
      table(SAMPLE, [], [null, null, null], ["", "ghi chú"]),
    );
    expect(lines).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("Pieces thiếu hoặc 0: bỏ kèm cảnh báo — chỉ khi dòng có dữ liệu", () => {
    const zero: TrialRow = ["G", "Zero", 0, 10, 10, 10];
    const missing: TrialRow = ["G", "Missing", null, 10, 10, 10];
    const empty: TrialRow = [null, null, 0, 10, 10, 10];
    const { lines, skipped } = parseTrialRows(table(SAMPLE, zero, missing, empty));
    expect(lines).toHaveLength(1);
    expect(skipped).toEqual([
      { row: 5, reason: "PIECES_MISSING" },
      { row: 6, reason: "PIECES_MISSING" },
      { row: 7, reason: "PIECES_MISSING" },
    ]);
  });

  it("dòng có chiều bằng 0 hoặc âm: bỏ kèm cảnh báo; Pieces lẻ cắt xuống (2,7 → 2), 0,5 → bị bỏ", () => {
    const flat: TrialRow = ["G", "Flat", 2, 10, 0, 10];
    const negative: TrialRow = ["G", "Neg", 2, 10, 10, -5];
    const fractional: TrialRow = ["G", "Frac", 2.7, 10, 10, 10];
    const half: TrialRow = ["G", "Half", 0.5, 10, 10, 10];
    const { lines, skipped } = parseTrialRows(table(SAMPLE, flat, negative, fractional, half));
    expect(lines.map((l) => [l.name, l.quantity])).toEqual([
      ["SW1701-1 5HK2394A", 10],
      ["Frac", 2],
    ]);
    expect(skipped).toEqual([
      { row: 5, reason: "NON_POSITIVE" },
      { row: 6, reason: "NON_POSITIVE" },
      { row: 8, reason: "PIECES_MISSING" },
    ]);
  });
});

describe("parseTrialRows — giá trị ô", () => {
  it("số kiểu chữ: dấu phẩy thập phân EU (chỉ có phẩy), phẩy nghìn (có cả chấm), đơn vị thừa", () => {
    const r = parseTrialRows([
      HEADER,
      [null, null, null, "millimeters"],
      ["", "a", "5 pcs", "72,5", "1,234.5", "30 mm"],
    ]);
    expect(r.lines[0]).toMatchObject({ quantity: 5, lengthMm: 73, widthMm: 1235, heightMm: 30 });
  });

  it("ô ngày hoặc chữ không có số = không phải số → dòng bị bỏ im lặng", () => {
    const r = parseTrialRows(
      table(SAMPLE, ["", "d", 1, new Date(), 1, 1], ["", "t", 1, "abc", 1, 1]),
    );
    expect(r.lines).toHaveLength(1);
    expect(r.skipped).toEqual([]);
  });

  it("tên: mô tả, rồi nhóm, rồi row-N; gộp khoảng trắng; cắt theo giới hạn của BE", () => {
    const rows = table(
      ["", "  Hộp \n  lớn ", 1, 1, 1, 1],
      ["G9", null, 1, 1, 1, 1],
      [null, null, 1, 1, 1, 1],
      ["g".repeat(150), "d".repeat(300), 1, 1, 1, 1],
    );
    const { lines } = parseTrialRows(rows);
    expect(lines.map((l) => l.name.slice(0, 12))).toEqual([
      "Hộp lớn",
      "G9",
      "row-6",
      "dddddddddddd",
    ]);
    expect(lines[3]?.name).toHaveLength(200);
    expect(lines[3]?.group).toHaveLength(100);
  });

  it("tóm tắt: số dòng, số nhóm khác nhau (không đếm nhóm trống), tổng kiện", () => {
    const { summary } = parseTrialRows(
      table(
        ["A", "x", 2, 1, 1, 1],
        ["A", "y", 3, 1, 1, 1],
        ["B", "z", 5, 1, 1, 1],
        [null, "w", 1, 1, 1, 1],
      ),
    );
    expect(summary).toMatchObject({ rows: 4, groups: 2, totalPieces: 11 });
  });
});

describe("parseTrialRows — lỗi như ValueError của Python", () => {
  it("không có dòng tiêu đề đủ Pieces/Length/Width/Height → NO_HEADER", () => {
    expect(() => parseTrialRows([["Pieces", "Length", "Width"]])).toThrowError(
      expect.objectContaining({ code: "NO_HEADER" }),
    );
    expect(() => parseTrialRows([])).toThrowError(expect.objectContaining({ code: "NO_HEADER" }));
  });

  it("có tiêu đề nhưng không dòng hàng hợp lệ → NO_ROWS", () => {
    expect(() => parseTrialRows(table(["", "zero", 0, 1, 1, 1]))).toThrowError(
      expect.objectContaining({ code: "NO_ROWS" }),
    );
  });
});
