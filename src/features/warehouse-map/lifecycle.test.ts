import { describe, expect, it } from "vitest";

import {
  LOCATION_STATUSES,
  WAREHOUSE_LOCATION_PERMISSIONS as LP,
  WAREHOUSE_PERMISSIONS as WP,
} from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { draftFromLayout } from "./draft";
import { draftReducer } from "./draft-edit";
import {
  groupRemovable,
  LOCATION_STATUS_TRANSITIONS,
  moveBlock,
  placeLocks,
  placeStatusTargets,
  warehouseMapActions,
} from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const actor = (codes: readonly PermissionCode[]) => ({
  can: (code: PermissionCode) => codes.includes(code),
});
/** Ba bộ quyền theo seed BE V20260928006000. */
const MANAGER = actor([...Object.values(WP), ...Object.values(LP)]);
const STAFF = actor([WP.viewPage, WP.read, LP.viewPage, LP.read]);
const PLANNER = actor([WP.viewPage, WP.read]);

describe("LOCATION_STATUS_TRANSITIONS (docs 06 §5)", () => {
  it("có đủ bốn trạng thái của bảng vòng đời", () => {
    expect(Object.keys(LOCATION_STATUS_TRANSITIONS).sort()).toEqual([...LOCATION_STATUSES].sort());
  });

  it("Active ⇄ Blocked ⇄ Maintenance, cả ba → Inactive", () => {
    expect(LOCATION_STATUS_TRANSITIONS.ACTIVE).toEqual(["BLOCKED", "MAINTENANCE", "INACTIVE"]);
    expect(LOCATION_STATUS_TRANSITIONS.BLOCKED).toContain("MAINTENANCE");
    expect(LOCATION_STATUS_TRANSITIONS.MAINTENANCE).toContain("BLOCKED");
  });

  it("Inactive chỉ về Active (khi chỗ còn trống — BE kiểm 409 LAYOUT_OVERLAP)", () => {
    expect(LOCATION_STATUS_TRANSITIONS.INACTIVE).toEqual(["ACTIVE"]);
  });

  it("không có trạng thái kết thúc: kệ / khu vực không xoá (BR-04)", () => {
    for (const status of LOCATION_STATUSES)
      expect(LOCATION_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
  });
});

describe("action-gating theo quyền (3 vai trò)", () => {
  it("Quản lý kho: tạo kho, vẽ bản đồ, xoá tường / cửa, đổi trạng thái", () => {
    expect(warehouseMapActions(MANAGER)).toEqual({
      createWarehouse: true,
      editLayout: true,
      updateLayout: true,
      deleteBoundary: true,
    });
    expect(placeStatusTargets("ACTIVE", MANAGER)).toEqual(["BLOCKED", "MAINTENANCE", "INACTIVE"]);
  });

  it("NV kho: chỉ xem bản đồ — không nút mutating nào", () => {
    expect(warehouseMapActions(STAFF)).toEqual({
      createWarehouse: false,
      editLayout: false,
      updateLayout: false,
      deleteBoundary: false,
    });
    expect(placeStatusTargets("ACTIVE", STAFF)).toEqual([]);
  });

  it("Inventory Planner: chỉ xem danh mục kho", () => {
    expect(warehouseMapActions(PLANNER).createWarehouse).toBe(false);
    expect(placeStatusTargets("INACTIVE", PLANNER)).toEqual([]);
  });
});

describe("chế độ sửa — phần nào của hình được sửa (placeLocks)", () => {
  const draft = draftFromLayout(LAYOUT);
  const savedShelf = draft.items.find((item) => item.key === "shelf-a01");
  const wall = draft.items.find((item) => item.key === "wall-n");
  const drawn = draftReducer(draft, {
    type: "draw",
    shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
  }).items.at(-1);
  const canOf = (a: ReturnType<typeof warehouseMapActions>) => ({
    update: a.updateLayout,
    delete: a.deleteBoundary,
  });
  const manager = canOf(warehouseMapActions(MANAGER));
  const staff = canOf(warehouseMapActions(STAFF));

  it("vào chế độ sửa cần warehouse-locations:CREATE — chỉ Quản lý kho", () => {
    expect(warehouseMapActions(MANAGER).editLayout).toBe(true);
    expect(warehouseMapActions(STAFF).editLayout).toBe(false);
    expect(warehouseMapActions(PLANNER).editLayout).toBe(false);
  });

  it("hình mới (chưa lưu) sửa / xoá tự do", () => {
    if (!drawn) throw new Error("thiếu hình vừa vẽ");
    expect(placeLocks(drawn, "free", staff)).toEqual({
      identity: false,
      geometry: false,
      remove: false,
    });
  });

  it("BR-04: kệ còn hàng hoặc đang kiểm tồn → khoá vị trí, kích thước và ngừng dùng; vẫn sửa tên", () => {
    if (!savedShelf) throw new Error("thiếu kệ A01");
    expect(placeLocks(savedShelf, "stocked", manager)).toEqual({
      identity: false,
      geometry: true,
      remove: true,
    });
    expect(placeLocks(savedShelf, "checking", manager).geometry).toBe(true);
    expect(placeLocks(savedShelf, "free", manager)).toEqual({
      identity: false,
      geometry: false,
      remove: false,
    });
  });

  it("BR-04: lý do không dời được kệ đã lưu — còn hàng / đang kiểm tồn / thiếu quyền", () => {
    if (!savedShelf || !wall || !drawn) throw new Error("thiếu dữ liệu mẫu");
    expect(moveBlock(savedShelf, "stocked", manager)).toBe("stocked");
    expect(moveBlock(savedShelf, "checking", manager)).toBe("checking");
    expect(moveBlock(savedShelf, "free", manager)).toBeNull();
    // Không kiểm được tồn → không khoá (Inspector cảnh báo), không báo chặn
    expect(moveBlock(savedShelf, "unknown", manager)).toBeNull();
    expect(moveBlock(savedShelf, "stocked", staff)).toBe("noUpdate");
    expect(moveBlock(wall, "free", staff)).toBe("noUpdate");
    // Hình mới chưa lưu không có tồn → luôn dời được
    expect(moveBlock(drawn, "stocked", staff)).toBeNull();
  });

  it("thiếu quyền UPDATE → không sửa được hình đã lưu; xoá tường cần quyền DELETE", () => {
    if (!savedShelf || !wall) throw new Error("thiếu dữ liệu mẫu");
    expect(placeLocks(savedShelf, "free", staff)).toEqual({
      identity: true,
      geometry: true,
      remove: true,
    });
    expect(placeLocks(wall, "free", manager).remove).toBe(false);
    expect(placeLocks(wall, "free", { update: true, delete: false }).remove).toBe(true);
  });
});

describe("xoá cả vùng chọn (groupRemovable) — BR-04", () => {
  const items = draftFromLayout(LAYOUT).items;
  const can = { update: true, delete: true };

  it("chỉ xoá hình đã biết không còn hàng; còn hàng, đang kiểm hoặc KIỂM LỖI đều bỏ qua", () => {
    const keysWhen = (stock: "free" | "stocked" | "checking" | "unknown") =>
      groupRemovable(items, (item) => (item.kind === "boundary" ? "free" : stock), can).map(
        (item) => item.key,
      );
    expect(keysWhen("free")).toEqual(["area-rcv", "shelf-a01", "wall-n"]);
    // Tường / cửa không có tồn — vẫn xoá được
    expect(keysWhen("stocked")).toEqual(["wall-n"]);
    expect(keysWhen("checking")).toEqual(["wall-n"]);
    expect(keysWhen("unknown")).toEqual(["wall-n"]);
  });

  it("thiếu quyền: không UPDATE thì không ngừng dùng kệ / khu, không DELETE thì không xoá tường", () => {
    const free = () => "free" as const;
    expect(groupRemovable(items, free, { update: false, delete: true }).map((i) => i.key)).toEqual([
      "wall-n",
    ]);
    expect(groupRemovable(items, free, { update: true, delete: false }).map((i) => i.key)).toEqual([
      "area-rcv",
      "shelf-a01",
    ]);
  });
});
