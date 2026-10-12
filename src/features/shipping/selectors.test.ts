import { describe, expect, it } from "vitest";

import { SHIPPING_FIELD_MESSAGES } from "@/constants";

import { apiLoad, line } from "./__fixtures__/load";
import { handoverInputSchema, scanPackageInputSchema } from "./input-schemas";
import { orderCount, reconcileLoad } from "./selectors";

describe("reconcileLoad — đối soát kế hoạch / thực tế", () => {
  it("tách kiện đã lên / chưa lên, kiện quét gần nhất lên đầu", () => {
    const load = apiLoad({
      lines: [line(1, "2026-10-12T01:00:00Z"), line(2, null), line(3, "2026-10-12T01:05:00Z")],
    });
    const result = reconcileLoad(load);
    expect(result.planned).toBe(3);
    expect(result.loaded).toBe(2);
    expect(result.loadedLines.map((l) => l.packageCode)).toEqual(["PKG-0003", "PKG-0001"]);
    expect(result.missingLines.map((l) => l.packageCode)).toEqual(["PKG-0002"]);
    expect(result.progress).toBe(66);
    expect(result.totalWeightKg).toBe(4.5);
  });

  it("chuyến rỗng → tiến độ 0", () => {
    expect(reconcileLoad(apiLoad({ lines: [] })).progress).toBe(0);
  });

  it("đếm đơn hàng khác nhau", () => {
    const load = apiLoad({
      lines: [line(1, null), { ...line(2, null), orderId: "ORD-2026-0001" }],
    });
    expect(orderCount(load)).toBe(1);
  });
});

describe("input schemas — quét kiện / bàn giao", () => {
  it("mã quét được trim + in hoa; rỗng bị chặn", () => {
    expect(scanPackageInputSchema.parse({ packageCode: "  pkg-0001 " }).packageCode).toBe(
      "PKG-0001",
    );
    expect(scanPackageInputSchema.safeParse({ packageCode: "  " }).success).toBe(false);
  });

  it("bàn giao cần tên đại diện hãng và xác nhận đã ký biên bản giấy", () => {
    const missingSign = handoverInputSchema.safeParse({ carrierRepresentative: "Anh Tài xế" });
    expect(missingSign.error?.issues[0]?.message).toBe(SHIPPING_FIELD_MESSAGES.signedRequired);
    expect(
      handoverInputSchema.safeParse({ carrierRepresentative: " ", signed: true }).success,
    ).toBe(false);
    expect(
      handoverInputSchema.safeParse({ carrierRepresentative: "Anh Tài xế", signed: true }).success,
    ).toBe(true);
  });
});
