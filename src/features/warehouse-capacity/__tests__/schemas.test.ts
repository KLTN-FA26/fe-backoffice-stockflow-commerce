import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";

import {
  capacityBoardDto,
  capacityBoardListDto,
  factorFromPercent,
  utilizationFactorInput,
} from "../schemas";
import { fullBoardJson, roomyBoardJson } from "./fixtures";

const V = UI_LABELS.warehouseCapacity.validation;
const errorOf = (factorPercent: string) => {
  const result = utilizationFactorInput.safeParse({ factorPercent });
  return result.success ? null : result.error.issues[0]?.message;
};

describe("capacityBoardDto — hợp đồng BE `WarehouseCapacityBoard`", () => {
  it("nhận BigDecimal dạng chuỗi và số; % vắng khi null (non_null)", () => {
    const board = capacityBoardDto.parse(fullBoardJson);
    expect(board.projectedFreeM3).toBe(-20);
    expect(board.occupiedPercent).toBe(95);
    const [list] = capacityBoardListDto.parse([roomyBoardJson]);
    expect(list?.groups.find((g) => g.kind === "AREA")?.capacityM3).toBeUndefined();
  });
  it("loại nhóm lạ → lỗi hợp đồng, không âm thầm hiện sai", () => {
    const broken = { ...roomyBoardJson, groups: [{ ...roomyBoardJson.groups[0], kind: "BIN" }] };
    expect(capacityBoardDto.safeParse(broken).success).toBe(false);
  });
});

describe("utilizationFactorInput — C43: hệ số trong (0%, 100%]", () => {
  it("nhận 85, 100, 0,5 và 85.25", () => {
    for (const value of ["85", "100", "0,5", "85.25"]) expect(errorOf(value)).toBeNull();
  });
  it("bắt buộc nhập", () => {
    expect(errorOf("  ")).toBe(V.factorRequired);
  });
  it("0% và trên 100% bị chặn", () => {
    expect(errorOf("0")).toBe(V.factorRange);
    expect(errorOf("100.01")).toBe(V.factorRange);
  });
  it("tối đa 2 chữ số thập phân, không nhận chữ / số âm", () => {
    expect(errorOf("85.125")).toBe(V.factorDecimals);
    expect(errorOf("-5")).toBe(V.factorDecimals);
    expect(errorOf("abc")).toBe(V.factorDecimals);
  });
});

describe("factorFromPercent", () => {
  it("phần trăm → hệ số BE (0, 1], 4 số lẻ", () => {
    expect(factorFromPercent("85")).toBe(0.85);
    expect(factorFromPercent("85,25")).toBe(0.8525);
    expect(factorFromPercent("100")).toBe(1);
  });
});
