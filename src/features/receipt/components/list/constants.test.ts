import { describe, expect, it } from "vitest";

import { PAGE_SIZE, RECEIPT_COLUMNS } from "@/constants";

import { DEFAULT_CONFIG, mergeStoredConfig } from "./constants";

const C = RECEIPT_COLUMNS;

describe("mergeStoredConfig — cấu hình cột lưu trong localStorage", () => {
  it("cấu hình cũ có cột Đơn đặt hàng → thay bằng Loại phiếu + Đơn sản xuất", () => {
    const merged = mergeStoredConfig(
      { visibleColumns: [C.NUMBER, "purchaseOrder", C.STATUS, C.ACTIONS], pageSize: PAGE_SIZE.md },
      DEFAULT_CONFIG,
    );
    expect(merged.visibleColumns).toEqual([
      C.NUMBER,
      C.RECEIPT_TYPE,
      C.PRODUCTION_ORDER,
      C.STATUS,
      C.ACTIONS,
    ]);
  });

  it("cấu hình mới giữ nguyên lựa chọn ẩn cột của người dùng", () => {
    const merged = mergeStoredConfig(
      { visibleColumns: [C.NUMBER, C.STATUS, C.ACTIONS] },
      DEFAULT_CONFIG,
    );
    expect(merged.visibleColumns).toEqual([C.NUMBER, C.STATUS, C.ACTIONS]);
  });
});
