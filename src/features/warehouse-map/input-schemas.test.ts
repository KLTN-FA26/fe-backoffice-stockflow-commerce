import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import {
  boundaryCreateSchema,
  EMPTY_WAREHOUSE_FORM,
  warehouseCreateSchema,
  zoneCreateSchema,
} from "./input-schemas";
import {
  areaCreateSchema,
  EMPTY_AREA_FORM,
  EMPTY_SHELF_FORM,
  shelfCreateSchema,
} from "./input-schemas-layout";

const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join("."));

const warehouse = (overrides: Partial<typeof EMPTY_WAREHOUSE_FORM> = {}) => ({
  ...EMPTY_WAREHOUSE_FORM,
  prefix: "hn",
  name: "Kho Hà Nội",
  address: "Lô CN2, KCN Bắc Thăng Long",
  mapWidth: "60",
  mapHeight: "40,5",
  ...overrides,
});

describe("khai báo kho (RegisterWarehouseRequest)", () => {
  it("hợp lệ: prefix tự viết hoa, dấu phẩy thập phân, địa chỉ hoàn hàng trống → null", () => {
    const out = warehouseCreateSchema.parse(warehouse());
    expect(out).toMatchObject({ prefix: "HN", mapWidth: 60, mapHeight: 40.5, returnAddress: null });
  });

  it("BR-10: prefix chỉ A–Z0–9, ≤ 10 ký tự, không có '-'", () => {
    for (const prefix of ["HN-1", "HÀNỘI", "ABCDEFGHIJK", ""]) {
      expect(messages(warehouseCreateSchema.safeParse(warehouse({ prefix })))).toContain("prefix");
    }
  });

  it("khung bản đồ > 0 và tối đa 3 số lẻ (không làm tròn)", () => {
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ mapWidth: "0" })))).toContain(
      "mapWidth",
    );
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ mapHeight: "1.2345" })))).toContain(
      "mapHeight",
    );
  });
});

describe("zone", () => {
  it("tên trùng (không phân biệt hoa thường) và màu sai định dạng bị chặn", () => {
    const schema = zoneCreateSchema(["Khu A - Sofa"]);
    expect(messages(schema.safeParse({ name: "khu a - sofa", color: "" }))).toContain("name");
    expect(messages(schema.safeParse({ name: "Khu C", color: "blue" }))).toContain("color");
    expect(schema.parse({ name: "Khu C", color: "" })).toEqual({ name: "Khu C", color: null });
  });
});

describe("tường / cửa", () => {
  const schema = boundaryCreateSchema({ mapWidth: 60, mapHeight: 40 });
  const base = {
    type: "WALL" as const,
    startX: "0",
    startY: "40",
    endX: "60",
    endY: "40",
    passable: true,
    operationalStatus: "OPEN" as const,
  };

  it("tường luôn không đi qua được, không có trạng thái", () => {
    expect(schema.parse(base)).toMatchObject({ passable: false, operationalStatus: null });
  });

  it("BR-06: đầu mút ngoài khung bị chặn; hai đầu trùng nhau bị chặn", () => {
    expect(schema.safeParse({ ...base, endX: "60.5" }).success).toBe(false);
    expect(schema.safeParse({ ...base, endX: "0", endY: "40" }).success).toBe(false);
  });
});

describe("kệ + tầng + tự sinh bin", () => {
  const schema = shelfCreateSchema(LAYOUT);
  const shelf = (overrides: Partial<typeof EMPTY_SHELF_FORM> = {}) => ({
    ...EMPTY_SHELF_FORM,
    code: "b01",
    name: "Kệ B01",
    x: "5",
    y: "14",
    width: "10",
    length: "1.2",
    ...overrides,
  });

  it("hợp lệ: mã viết hoa, số đo đổi sang số", () => {
    expect(schema.parse(shelf())).toMatchObject({
      code: "B01",
      rotation: 0,
      levelCount: 2,
      rowCount: 1,
    });
  });

  it("BR-06: ra ngoài khung bản đồ bị chặn ở ô X", () => {
    expect(messages(schema.safeParse(shelf({ x: "55" })))).toContain("x");
  });

  it("BR-07: chồng lấn kệ đang dùng bị chặn; chỗ của kệ INACTIVE thì được", () => {
    expect(messages(schema.safeParse(shelf({ y: "5.5" })))).toContain("x");
    expect(schema.safeParse(shelf({ x: "30", y: "30", width: "2", length: "2" })).success).toBe(
      true,
    );
  });

  it("mã kệ đã có trong kho bị chặn", () => {
    expect(messages(schema.safeParse(shelf({ code: "a01" })))).toContain("code");
  });

  it("BR-08: bin cho lấy hàng mà kệ không có mặt lấy hàng nào bị chặn", () => {
    const noFace = { north: false, east: false, south: false, west: false };
    expect(messages(schema.safeParse(shelf({ ...noFace, pickable: true })))).toContain("north");
    expect(schema.safeParse(shelf({ ...noFace, pickable: false })).success).toBe(true);
  });

  it("BR-14 / BR-15: hàng × cột ≤ 200, ≤ 26 hàng kiểu chữ, ≤ 20 tầng", () => {
    expect(messages(schema.safeParse(shelf({ rowCount: "10", columnCount: "21" })))).toContain(
      "columnCount",
    );
    expect(
      messages(
        schema.safeParse(
          shelf({ rowCount: "27", columnCount: "1", namingScheme: "ROW_LETTER_COLUMN" }),
        ),
      ),
    ).toContain("rowCount");
    expect(messages(schema.safeParse(shelf({ levelCount: "21" })))).toContain("levelCount");
  });

  it("BR-09: góc xoay chỉ 0 / 90 / 180 / 270", () => {
    expect(schema.safeParse(shelf({ rotation: "45" as "0" })).success).toBe(false);
  });
});

describe("khu vực", () => {
  it("BR-07 + mã khu trùng bị chặn; khu NON_STORAGE vẫn đặt được", () => {
    const schema = areaCreateSchema(LAYOUT);
    const area = {
      ...EMPTY_AREA_FORM,
      code: "pack01",
      name: "Đóng gói",
      x: "40",
      y: "20",
      width: "10",
      length: "6",
    };
    expect(schema.parse(area)).toMatchObject({ code: "PACK01" });
    expect(messages(schema.safeParse({ ...area, y: "5" }))).toContain("x");
    expect(messages(schema.safeParse({ ...area, code: "rcv01" }))).toContain("code");
    expect(schema.safeParse({ ...area, type: "NON_STORAGE" }).success).toBe(true);
  });
});
