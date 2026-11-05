import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "@/constants";

import { clearOpenLoadRequestId, openLoadFingerprint, openLoadRequestId } from "./request-ids";

const intent = { warehouseId: "w", carrierId: "c", shipmentIds: ["s2", "s1"] };

beforeEach(() => {
  clearOpenLoadRequestId();
});

describe("requestId mở chuyến (sessionStorage)", () => {
  it("cùng ý định (kể cả thứ tự lô khác) → cùng id: gửi lại sau mất phản hồi không mở chuyến thứ hai", () => {
    const first = openLoadRequestId(openLoadFingerprint(intent));
    const again = openLoadRequestId(openLoadFingerprint({ ...intent, shipmentIds: ["s1", "s2"] }));
    expect(again).toBe(first);
  });

  it("đổi nội dung (hãng, lô, biển số) → id mới: dùng lại id cũ sẽ nhận về chuyến cũ", () => {
    const first = openLoadRequestId(openLoadFingerprint(intent));
    expect(openLoadRequestId(openLoadFingerprint({ ...intent, carrierId: "c2" }))).not.toBe(first);
    const second = openLoadRequestId(openLoadFingerprint({ ...intent, vehiclePlate: "51C-1" }));
    expect(second).not.toBe(first);
  });

  it("id sống qua tải lại trang (sessionStorage) và bỏ đi khi mở thành công", () => {
    const first = openLoadRequestId(openLoadFingerprint(intent));
    expect(sessionStorage.getItem(STORAGE_KEYS.loadOpenRequest)).toContain(first);
    clearOpenLoadRequestId();
    expect(sessionStorage.getItem(STORAGE_KEYS.loadOpenRequest)).toBeNull();
    expect(openLoadRequestId(openLoadFingerprint(intent))).not.toBe(first);
  });

  it("sessionStorage bị chặn → vẫn dùng lại id trong bộ nhớ", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      const first = openLoadRequestId(openLoadFingerprint(intent));
      expect(openLoadRequestId(openLoadFingerprint(intent))).toBe(first);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
