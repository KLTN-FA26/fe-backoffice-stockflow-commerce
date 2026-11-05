/**
 * Cửa thùng của loại xe (BE PR #158, migration V20261022001100, LP3-DOOR): mock giữ đúng số liệu backfill của
 * migration, quy tắc 1..30000 / không lớn hơn thùng, mã lỗi trường, và PUT thay thế toàn bộ (cửa vắng = xoá).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { resetVehicleTypeMockStore } from "@/lib/api/mock-vehicle-type-store";

import {
  PATH,
  MANAGER,
  actAs,
  body,
  call,
  errorCode,
  list,
  presetBody,
} from "./__fixtures__/mock-contract";
import { apiCustomTruck } from "./__fixtures__/vehicle-type";
import { bodyOfVehicleType } from "./api";
import { beVehicleTypeSchema } from "./schemas";

beforeEach(() => {
  resetVehicleTypeMockStore();
  actAs(MANAGER);
});

const fieldErrorsOf = (res: { data: unknown }) =>
  (res.data as { fieldErrors?: { field: string; code?: string }[] }).fieldErrors ?? [];

describe("mock loại xe — cửa của 10 loại mặc định theo migration BE PR #158", () => {
  it("20DC / 40DC 2340 × 2280, 40HC / 45HC 2340 × 2585, xe tải và bán tải không giới hạn cửa", async () => {
    const byCode = Object.fromEntries((await list({ size: 50 })).items.map((r) => [r.code, r]));
    for (const code of ["20DC", "40DC"])
      expect(byCode[code]).toMatchObject({ doorWidthMm: 2340, doorHeightMm: 2280 });
    for (const code of ["40HC", "45HC"])
      expect(byCode[code]).toMatchObject({ doorWidthMm: 2340, doorHeightMm: 2585 });
    for (const code of ["PICKUP", "TRUCK-1T25", "TRUCK-2T5", "TRUCK-5T", "TRUCK-8T", "TRUCK-15T"]) {
      expect(byCode[code]?.doorWidthMm ?? null).toBeNull();
      expect(byCode[code]?.doorHeightMm ?? null).toBeNull();
    }
  });
});

describe("mock loại xe — POST / PUT với cửa", () => {
  it("tạo không gửi cửa: 201, cửa null; gửi đủ thì lưu lại", async () => {
    const plain = beVehicleTypeSchema.parse((await call("POST", PATH, body())).data);
    expect(plain.doorWidthMm ?? null).toBeNull();
    expect(plain.doorHeightMm ?? null).toBeNull();
    const withDoor = await call(
      "POST",
      PATH,
      body({ code: "DOOR-1", doorWidthMm: 1800, doorHeightMm: 1900 }),
    );
    expect(withDoor.status).toBe(201);
    expect(beVehicleTypeSchema.parse(withDoor.data)).toMatchObject({
      doorWidthMm: 1800,
      doorHeightMm: 1900,
    });
  });

  it("mỗi phía đặt riêng được: phía vắng là không giới hạn", async () => {
    const res = await call("POST", PATH, body({ doorWidthMm: 1500 }));
    expect(res.status).toBe(201);
    const row = beVehicleTypeSchema.parse(res.data);
    expect(row.doorWidthMm).toBe(1500);
    expect(row.doorHeightMm ?? null).toBeNull();
  });

  it("ngoài 1..30000 → 400 VALIDATION_FAILED, mã VEHICLE_TYPE_DOOR_INVALID trên đúng ô", async () => {
    for (const bad of [0, -5, 30001, 12.5]) {
      const res = await call("POST", PATH, body({ doorWidthMm: bad, doorHeightMm: 1900 }));
      expect([res.status, errorCode(res)]).toEqual([400, "VALIDATION_FAILED"]);
      expect(fieldErrorsOf(res)).toEqual([
        expect.objectContaining({ field: "doorWidthMm", code: "VEHICLE_TYPE_DOOR_INVALID" }),
      ]);
    }
  });

  it("lớn hơn thùng → VEHICLE_TYPE_DOOR_TOO_LARGE; bằng thùng thì được (rộng 1900, cao 1900)", async () => {
    const res = await call("POST", PATH, body({ doorWidthMm: 1901, doorHeightMm: 1901 }));
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "doorWidthMm", code: "VEHICLE_TYPE_DOOR_TOO_LARGE" }),
      expect.objectContaining({ field: "doorHeightMm", code: "VEHICLE_TYPE_DOOR_TOO_LARGE" }),
    ]);
    const equal = await call("POST", PATH, body({ doorWidthMm: 1900, doorHeightMm: 1900 }));
    expect(equal.status).toBe(201);
  });

  it("PUT thay thế toàn bộ: cửa vắng = xoá, gửi null cũng xoá, gửi số thì đổi", async () => {
    const [preset] = (await list({ search: "20DC" })).items;
    const url = `${PATH}/${preset?.vehicleTypeId}`;
    expect(preset).toMatchObject({ doorWidthMm: 2340, doorHeightMm: 2280 });
    // Vắng cả hai → xoá
    const omitted = await call("PUT", url, {
      ...presetBody(preset, { doorWidthMm: undefined, doorHeightMm: undefined }),
      version: 0,
    });
    const cleared = beVehicleTypeSchema.parse(omitted.data);
    expect(cleared.doorWidthMm ?? null).toBeNull();
    expect(cleared.doorHeightMm ?? null).toBeNull();
    // null + số mới
    const mixed = await call("PUT", url, {
      ...presetBody(preset, { doorWidthMm: null, doorHeightMm: 2000 }),
      version: 1,
    });
    const saved = beVehicleTypeSchema.parse(mixed.data);
    expect(saved.doorWidthMm ?? null).toBeNull();
    expect(saved.doorHeightMm).toBe(2000);
  });

  it("PUT kiểm cửa theo thùng mới: đổi rộng trong nhỏ hơn cửa → DOOR_TOO_LARGE", async () => {
    const [preset] = (await list({ search: "20DC" })).items;
    const res = await call("PUT", `${PATH}/${preset?.vehicleTypeId}`, {
      ...presetBody(preset, { innerWidthMm: 2000 }),
      version: 0,
    });
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "doorWidthMm", code: "VEHICLE_TYPE_DOOR_TOO_LARGE" }),
    ]);
  });
});

describe("bodyOfVehicleType — PUT luôn gửi cả hai ô cửa", () => {
  it("không có cửa → null (không phải undefined, để BE xoá thay vì hiểu là bỏ sót)", () => {
    const sent = bodyOfVehicleType(apiCustomTruck());
    expect(sent.doorWidthMm).toBeNull();
    expect(sent.doorHeightMm).toBeNull();
    expect(JSON.parse(JSON.stringify(sent))).toMatchObject({
      doorWidthMm: null,
      doorHeightMm: null,
    });
  });

  it("có cửa → giữ nguyên số của dòng; BE bỏ trường null (vắng) vẫn ra null", () => {
    expect(
      bodyOfVehicleType(apiCustomTruck({ doorWidthMm: 1800, doorHeightMm: 1900 })),
    ).toMatchObject({
      doorWidthMm: 1800,
      doorHeightMm: 1900,
    });
    const { doorWidthMm: _w, doorHeightMm: _h, ...wire } = apiCustomTruck();
    expect(bodyOfVehicleType(wire as never)).toMatchObject({
      doorWidthMm: null,
      doorHeightMm: null,
    });
  });
});
