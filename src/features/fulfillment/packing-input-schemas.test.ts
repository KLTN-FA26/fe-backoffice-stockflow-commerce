import { describe, expect, it } from "vitest";

import { PACKING_FIELD_MESSAGES as MSG } from "@/constants";

import {
  completeInputSchema,
  quantitySchema,
  scanDetailSchema,
  scanQuantityInputSchema,
  sealInputSchema,
} from "./packing-input-schemas";

const seal = (overrides: Record<string, string> = {}) =>
  sealInputSchema.safeParse({
    weightKg: "1,25",
    lengthCm: "30",
    widthCm: "20.5",
    heightCm: "10",
    packageType: "CARTON",
    rotatable: "default",
    fragile: "default",
    ...overrides,
  });

describe("sealInputSchema — BE SealPackageRequest (BR-03 docs 08: số đo thực bắt buộc)", () => {
  it("nhận dấu phẩy thập phân kiểu VN; cờ mặc định → để BE tính từ SKU (undefined), Có / Không = ghi đè", () => {
    const parsed = seal({ rotatable: "no", fragile: "yes" });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      weightKg: 1.25,
      lengthCm: 30,
      widthCm: 20.5,
      heightCm: 10,
      packageType: "CARTON",
      rotatable: false,
      fragile: true,
    });
    expect(seal().data).toMatchObject({ rotatable: undefined, fragile: undefined });
  });

  it.each(["weightKg", "lengthCm", "widthCm", "heightCm"])(
    "%s bỏ trống / 0 / âm / chữ → lỗi theo ô",
    (field) => {
      for (const bad of ["", "0", "-1", "abc", "1e3"]) {
        const result = seal({ [field]: bad });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.path).toEqual([field]);
      }
    },
  );

  it("giới hạn BE: dài / rộng / cao ≤ 100000 và 2 số lẻ; khối lượng 3 số lẻ", () => {
    expect(seal({ lengthCm: "100000" }).success).toBe(true);
    expect(seal({ lengthCm: "100000.01" }).error?.issues[0]?.message).toBe(MSG.dimensionTooLarge);
    expect(seal({ widthCm: "1.234" }).error?.issues[0]?.message).toBe(MSG.dimensionScale);
    expect(seal({ weightKg: "1.2345" }).error?.issues[0]?.message).toBe(MSG.weightScale);
    expect(seal({ weightKg: "10000000" }).error?.issues[0]?.message).toBe(MSG.weightTooLarge);
  });

  it("loại kiện ngoài danh sách BE → lỗi", () => {
    expect(seal({ packageType: "DRUM" }).success).toBe(false);
  });
});

describe("quantitySchema / scanQuantityInputSchema — BE @Positive @Max(1_000_000)", () => {
  it("số nguyên 1..1.000.000", () => {
    expect(scanQuantityInputSchema.parse("3")).toBe(3);
    expect(scanQuantityInputSchema.safeParse("0").success).toBe(false);
    expect(scanQuantityInputSchema.safeParse("1,5").success).toBe(false);
    expect(scanQuantityInputSchema.safeParse("").success).toBe(false);
    expect(scanQuantityInputSchema.safeParse("1000001").error?.issues[0]?.message).toBe(
      MSG.quantityTooLarge,
    );
  });

  it("không bớt quá số đang có trong kiện", () => {
    expect(quantitySchema(2).safeParse("3").error?.issues[0]?.message).toBe(
      MSG.quantityExceedsHeld,
    );
    expect(quantitySchema(2).parse("2")).toBe(2);
  });
});

describe("scanDetailSchema — dòng / lô / serial bắt buộc theo dòng hàng", () => {
  it("dòng theo lô cần lô; theo serial cần serial; nhiều dòng cần chọn dòng", () => {
    const schema = scanDetailSchema({ needsLine: true, needsLot: true, needsSerial: true });
    const bad = schema.safeParse({ orderLineId: "", lotNumber: " ", serialNumber: "" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.message).sort()).toEqual(
      [MSG.lineRequired, MSG.lotRequired, MSG.serialRequired].sort(),
    );
    expect(
      scanDetailSchema({ needsLine: false, needsLot: false, needsSerial: false }).safeParse({
        orderLineId: "",
        lotNumber: "",
        serialNumber: "",
      }).success,
    ).toBe(true);
  });
});

describe("completeInputSchema — BR-01 docs 08: giao một phần phải nói lý do", () => {
  it("đóng đủ: ghi chú tuỳ ý; một phần: bắt buộc, tối đa 500 ký tự", () => {
    expect(completeInputSchema.safeParse({ mode: "full", note: "" }).success).toBe(true);
    const missing = completeInputSchema.safeParse({ mode: "partial", note: "  " });
    expect(missing.error?.issues[0]).toMatchObject({ message: MSG.noteRequired, path: ["note"] });
    expect(completeInputSchema.safeParse({ mode: "partial", note: "hết hàng" }).data?.note).toBe(
      "hết hàng",
    );
    expect(
      completeInputSchema.safeParse({ mode: "partial", note: "x".repeat(501) }).error?.issues[0]
        ?.message,
    ).toBe(MSG.noteTooLong);
  });
});
