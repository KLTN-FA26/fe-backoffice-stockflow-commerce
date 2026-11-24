import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { areaLocationCode, placesOf, shelfOfLocation } from "./location-pick";

describe("location-pick — chỗ của mã vị trí trên mặt bằng 2D", () => {
  it("bin → cả kệ chứa nó; khu → chính khu; không trùng, bỏ mã không có trên bản đồ", () => {
    const marks = placesOf(LAYOUT, ["hcm-a01-1-a", "HCM-A01-2-A", "HCM-RCV01", "HCM-NOPE", ""]);
    expect(marks.map((mark) => mark.id)).toEqual(["shelf-a01", "area-rcv"]);
    expect(marks[0]?.box).toEqual({ x: 5, y: 5, w: 10, h: 1.2 });
    expect(placesOf(LAYOUT, [])).toEqual([]);
  });

  it("tìm kệ của một bin để mở sẵn lưới bin", () => {
    expect(shelfOfLocation(LAYOUT, " hcm-a01-2-a")?.id).toBe("shelf-a01");
    expect(shelfOfLocation(LAYOUT, "HCM-RCV01")).toBeUndefined();
    expect(shelfOfLocation(LAYOUT, "")).toBeUndefined();
  });

  it("mã vị trí của khu; kệ / khu lạ → null", () => {
    expect(areaLocationCode(LAYOUT, "area-rcv")).toBe("HCM-RCV01");
    expect(areaLocationCode(LAYOUT, "shelf-a01")).toBeNull();
  });
});
