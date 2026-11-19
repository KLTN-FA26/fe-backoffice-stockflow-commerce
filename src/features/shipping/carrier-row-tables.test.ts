import { describe, expect, it } from "vitest";

import { CARRIER_CONFIG_LIMITS, CARRIER_CONFIG_MESSAGES as MSG } from "@/constants";

import {
  failureReasonMapFromRows,
  failureReasonRowsFromMap,
  failureReasonSignature,
  normaliseWording,
  validateFailureReasonRows,
} from "./carrier-failure-rows";
import {
  emptyPickupPointRow,
  pickupPointBodies,
  pickupPointRowsFrom,
  pickupPointSignature,
  validatePickupPointRows,
} from "./carrier-pickup-rows";
import { REQUIRED, hasRowErrors } from "./carrier-row-core";
import {
  emptyServiceCodeRow,
  serviceCodeBodies,
  serviceCodeRowsFrom,
  serviceCodeSignature,
  validateServiceCodeRows,
} from "./carrier-service-code-rows";

import type { FailureReasonRow } from "./carrier-failure-rows";
import type { PickupPointRow } from "./carrier-pickup-rows";
import type { ServiceCodeRow } from "./carrier-service-code-rows";

const reason = (
  wording: string,
  code: FailureReasonRow["reason"],
  key = wording,
): FailureReasonRow => ({
  key,
  wording,
  reason: code,
});
const code = (patch: Partial<ServiceCodeRow> = {}): ServiceCodeRow => ({
  ...emptyServiceCodeRow(),
  vehicleTypeId: "vt-1",
  provinceCode: "79",
  carrierCityCode: "SGN",
  serviceCode: "SGN-TRUCK-500",
  ...patch,
});
const point = (patch: Partial<PickupPointRow> = {}): PickupPointRow => ({
  ...emptyPickupPointRow(),
  warehouseId: "wh-1",
  provinceCode: "79",
  address: "1 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
  ...patch,
});

describe("bảng lý do giao thất bại (BE FailureReasonMap)", () => {
  it("đi và về với bảng của BE; bảng gửi đi cắt khoảng trắng, bỏ dòng trống", () => {
    const rows = failureReasonRowsFromMap({
      "Khách vắng": "CUSTOMER_ABSENT",
      "Sai địa chỉ": "WRONG_ADDRESS",
    });
    expect(rows.map((r) => [r.wording, r.reason])).toEqual([
      ["Khách vắng", "CUSTOMER_ABSENT"],
      ["Sai địa chỉ", "WRONG_ADDRESS"],
    ]);
    expect(
      failureReasonMapFromRows([...rows, reason("  Hàng hỏng ", "DAMAGED"), reason("", "")]),
    ).toEqual({
      "Khách vắng": "CUSTOMER_ABSENT",
      "Sai địa chỉ": "WRONG_ADDRESS",
      "Hàng hỏng": "DAMAGED",
    });
    expect(failureReasonRowsFromMap(null)).toEqual([]);
  });

  it("mã lý do lạ của BE về thành ô trống (người dùng phải chọn lại)", () => {
    expect(failureReasonRowsFromMap({ x: "SOMETHING_NEW" })[0]?.reason).toBe("");
  });

  it("so lý do như BE: bỏ hoa thường, gộp khoảng trắng, NFC → lý do trùng bị chặn", () => {
    expect(normaliseWording("  KHÁCH   Vắng ")).toBe(normaliseWording("khách vắng"));
    // "á" dựng sẵn so với "a" + dấu rời
    expect(normaliseWording("Khách vắng")).toBe(normaliseWording("Khách vắng"));
    const errors = validateFailureReasonRows([
      reason("Khách vắng", "CUSTOMER_ABSENT", "a"),
      reason("KHÁCH  VẮNG", "REFUSED", "b"),
    ]);
    expect(errors[0]).toEqual({});
    expect(errors[1]?.wording).toBe(MSG.wordingDuplicate);
  });

  it("dòng bỏ trống hoàn toàn không tính; dòng điền dở thì ô thiếu bị đánh dấu bắt buộc", () => {
    expect(hasRowErrors(validateFailureReasonRows([reason("", "")]))).toBe(false);
    expect(validateFailureReasonRows([reason("Khách vắng", "")])[0]).toEqual({ reason: REQUIRED });
    expect(validateFailureReasonRows([reason("", "OTHER")])[0]).toEqual({ wording: REQUIRED });
  });

  it("lý do tối đa 200 ký tự, tối đa 100 dòng", () => {
    const long = "a".repeat(CARRIER_CONFIG_LIMITS.failureReasonWordingMax + 1);
    expect(validateFailureReasonRows([reason(long, "OTHER")])[0]?.wording).toBe(MSG.tooLong);
    const many = Array.from({ length: CARRIER_CONFIG_LIMITS.failureReasonMaxRows + 1 }, (_, i) =>
      reason(`lý do ${i}`, "OTHER", `k${i}`),
    );
    expect(hasRowErrors(validateFailureReasonRows(many))).toBe(true);
    expect(hasRowErrors(validateFailureReasonRows(many.slice(1)))).toBe(false);
  });

  it("chữ ký chỉ đổi khi nội dung đổi (thứ tự, hoa thường, khoảng trắng, dòng trống không tính)", () => {
    const a = [
      reason("Khách vắng", "CUSTOMER_ABSENT", "1"),
      reason("Sai địa chỉ", "WRONG_ADDRESS", "2"),
    ];
    const b = [
      reason(" sai địa chỉ", "WRONG_ADDRESS", "x"),
      reason("KHÁCH VẮNG", "CUSTOMER_ABSENT", "y"),
      reason("", "", "z"),
    ];
    expect(failureReasonSignature(a)).toBe(failureReasonSignature(b));
    expect(failureReasonSignature(a)).not.toBe(
      failureReasonSignature([reason("Khách vắng", "REFUSED"), a[1] as FailureReasonRow]),
    );
    expect(failureReasonSignature([])).toBe(failureReasonSignature([reason("", "")]));
  });
});

describe("bảng mã dịch vụ (BE CarrierServiceCodeService)", () => {
  it("đi và về với DTO của BE; thân gửi cắt khoảng trắng và bỏ dòng trống", () => {
    const rows = serviceCodeRowsFrom([
      {
        vehicleTypeId: "vt-1",
        vehicleTypeCode: "TRUCK-1T25",
        provinceCode: "79",
        carrierCityCode: "SGN",
        serviceCode: "S1",
      },
    ]);
    expect(rows[0]?.vehicleTypeCode).toBe("TRUCK-1T25");
    expect(
      serviceCodeBodies([...rows, code({ serviceCode: " S2 " }), emptyServiceCodeRow()]),
    ).toEqual([
      { vehicleTypeId: "vt-1", provinceCode: "79", carrierCityCode: "SGN", serviceCode: "S1" },
      { vehicleTypeId: "vt-1", provinceCode: "79", carrierCityCode: "SGN", serviceCode: "S2" },
    ]);
  });

  it("mỗi loại xe một mã mỗi tỉnh: dòng sau trùng bị đánh dấu ở ô tỉnh; khác loại xe hoặc khác tỉnh thì được", () => {
    const errors = validateServiceCodeRows([code({ key: "a" }), code({ key: "b" })]);
    expect(errors[0]).toEqual({});
    expect(errors[1]?.provinceCode).toBe(MSG.serviceCodeDuplicate);
    expect(
      hasRowErrors(
        validateServiceCodeRows([
          code({ key: "a" }),
          code({ key: "b", vehicleTypeId: "vt-2" }),
          code({ key: "c", provinceCode: "01" }),
        ]),
      ),
    ).toBe(false);
  });

  it("ô mã: bắt buộc, in được không khoảng trắng, tối đa 20 / 32 / 64 ký tự", () => {
    expect(validateServiceCodeRows([code({ carrierCityCode: "" })])[0]).toEqual({
      carrierCityCode: REQUIRED,
    });
    expect(validateServiceCodeRows([code({ serviceCode: "dịch vụ 1" })])[0]?.serviceCode).toBe(
      MSG.noSpaces,
    );
    expect(validateServiceCodeRows([code({ provinceCode: "7".repeat(21) })])[0]?.provinceCode).toBe(
      MSG.tooLong,
    );
    expect(
      validateServiceCodeRows([code({ carrierCityCode: "S".repeat(33) })])[0]?.carrierCityCode,
    ).toBe(MSG.tooLong);
    expect(validateServiceCodeRows([code({ serviceCode: "S".repeat(65) })])[0]?.serviceCode).toBe(
      MSG.tooLong,
    );
    expect(validateServiceCodeRows([code({ vehicleTypeId: "" })])[0]).toEqual({
      vehicleTypeId: REQUIRED,
    });
  });

  it("dòng bỏ trống hoàn toàn không tính; chữ ký không phụ thuộc thứ tự dòng", () => {
    expect(hasRowErrors(validateServiceCodeRows([emptyServiceCodeRow()]))).toBe(false);
    const a = code({ key: "1" });
    const b = code({ key: "2", provinceCode: "01" });
    expect(serviceCodeSignature([a, b])).toBe(serviceCodeSignature([b, a, emptyServiceCodeRow()]));
    expect(serviceCodeSignature([a])).not.toBe(
      serviceCodeSignature([code({ serviceCode: "KHAC" })]),
    );
  });
});

describe("bảng điểm lấy hàng (BE CarrierPickupPoints)", () => {
  it("thân gửi: cắt khoảng trắng, người liên hệ / điện thoại trống thì vắng", () => {
    expect(pickupPointBodies([point({ address: "  địa chỉ  " }), emptyPickupPointRow()])).toEqual([
      {
        warehouseId: "wh-1",
        provinceCode: "79",
        address: "địa chỉ",
        contactName: undefined,
        contactPhone: undefined,
      },
    ]);
    expect(
      pickupPointRowsFrom([
        {
          warehouseId: "w",
          provinceCode: "79",
          address: "a",
          contactName: null,
          contactPhone: "090",
        },
      ])[0],
    ).toMatchObject({ contactName: "", contactPhone: "090" });
  });

  it("mỗi kho một điểm; địa chỉ bắt buộc, tối đa 500; tỉnh in được không khoảng trắng", () => {
    const errors = validatePickupPointRows([point({ key: "a" }), point({ key: "b" })]);
    expect(errors[1]?.warehouseId).toBe(MSG.pickupWarehouseDuplicate);
    expect(validatePickupPointRows([point({ address: "" })])[0]).toEqual({ address: REQUIRED });
    expect(validatePickupPointRows([point({ address: "a".repeat(501) })])[0]?.address).toBe(
      MSG.tooLong,
    );
    expect(validatePickupPointRows([point({ provinceCode: "TP HCM" })])[0]?.provinceCode).toBe(
      MSG.noSpaces,
    );
    expect(validatePickupPointRows([point({ warehouseId: "" })])[0]).toEqual({
      warehouseId: REQUIRED,
    });
    expect(
      validatePickupPointRows([
        point({ contactName: "n".repeat(121), contactPhone: "0".repeat(33) }),
      ])[0],
    ).toEqual({
      contactName: MSG.tooLong,
      contactPhone: MSG.tooLong,
    });
    expect(hasRowErrors(validatePickupPointRows([emptyPickupPointRow()]))).toBe(false);
  });

  it("chữ ký không phụ thuộc thứ tự và khoảng trắng thừa", () => {
    const a = point({ key: "1" });
    const b = point({ key: "2", warehouseId: "wh-2" });
    expect(pickupPointSignature([a, b])).toBe(
      pickupPointSignature([b, point({ key: "x", address: ` ${a.address} ` })]),
    );
    expect(pickupPointSignature([a])).not.toBe(
      pickupPointSignature([point({ contactPhone: "0909" })]),
    );
  });
});
