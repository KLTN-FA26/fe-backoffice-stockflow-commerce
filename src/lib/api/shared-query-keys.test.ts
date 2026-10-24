/**
 * Root key dùng chung giữa các feature (không import chéo): `load-planning` build key ô chọn loại xe dưới đúng root mà
 * danh mục loại xe (`vehicle-type`) sở hữu, để sửa / ngừng dùng một loại xe làm mới cả hai — và để không còn chuỗi gõ tay lệch nhau.
 */
import { describe, expect, it } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { loadEstimateKeys } from "@/features/load-planning";
import { vehicleTypeKeys } from "@/features/vehicle-type";

describe("SHARED_QUERY_ROOTS.vehicleTypes", () => {
  it("là root của danh mục loại xe và của ô chọn loại xe trong ước tính xếp xe", () => {
    expect(SHARED_QUERY_ROOTS.vehicleTypes).toBe("fulfillment-vehicle-types");
    expect(vehicleTypeKeys.all).toEqual([SHARED_QUERY_ROOTS.vehicleTypes]);
    expect(loadEstimateKeys.vehicleTypes()[0]).toBe(SHARED_QUERY_ROOTS.vehicleTypes);
  });

  it("key ô chọn nằm dưới root của danh mục nên invalidate `vehicleTypeKeys.all` khớp được nó", () => {
    const root = vehicleTypeKeys.all;
    expect(loadEstimateKeys.vehicleTypes().slice(0, root.length)).toEqual([...root]);
    // nhưng không trùng key danh sách / chi tiết của danh mục
    expect(loadEstimateKeys.vehicleTypes()).not.toEqual(vehicleTypeKeys.list({}));
  });
});
