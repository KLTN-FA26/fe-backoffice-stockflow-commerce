import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { LAYOUT } from "./__fixtures__/layout";
import { generateShelfBins } from "./api";
import { saveArea, saveShelf } from "./api-draft";
import { DEFAULT_SHELF_BUILD, draftFromLayout } from "./draft";

/**
 * Body gửi BE của chế độ sửa bản đồ khớp `ShelfRequests` / `AreaRequests` hiện tại: BE bỏ storage class khỏi
 * domain kho và sức chứa tính theo thể tích (kltn-docs 06, 2026-11-05; 06 BR-19) — không còn
 * `defaultStorageClass`, `storageClass`, `storageClassOverride`, `capacityUnits`.
 */
vi.mock("@/lib/api/client", () => ({
  api: {
    post: vi.fn(async () => ({ data: { id: "new", version: 0 } })),
    put: vi.fn(async () => ({ data: { id: "saved", version: 1 } })),
  },
}));

const GONE = ["defaultStorageClass", "storageClass", "storageClassOverride", "capacityUnits"];

/** Body của lần gọi `api.post` / `api.put` gần nhất. */
function lastBody(method: "post" | "put"): Record<string, unknown> {
  const call = vi.mocked(api[method]).mock.calls.at(-1);
  if (!call) throw new Error(`chưa gọi api.${method}`);
  return call[1] as Record<string, unknown>;
}

/** Key thật sự lên dây: JSON bỏ key mang `undefined` (trường tuỳ chọn để trống). */
const wireKeys = (value: unknown): string[] =>
  Object.keys(JSON.parse(JSON.stringify(value)) as Record<string, unknown>).sort();

const draft = draftFromLayout(LAYOUT);
const shelf = draft.items.find((item) => item.kind === "shelf");
const area = draft.items.find((item) => item.kind === "area");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("body lưu bản nháp bản đồ — không còn storage class / capacityUnits", () => {
  it("sửa kệ: chỉ tên, mô tả, zone, footprint, vật cản, mặt lấy hàng, version", async () => {
    if (shelf?.kind !== "shelf") throw new Error("thiếu kệ trong fixture");
    await saveShelf("wh-1", shelf, null);
    const body = lastBody("put");
    for (const key of GONE) expect(body).not.toHaveProperty(key);
    expect(wireKeys(body)).toEqual(
      ["footprint", "name", "obstacle", "pickFaces", "version"].sort(),
    );
  });

  it("tạo kệ mới: thêm mã, không gửi lớp lưu trữ", async () => {
    if (shelf?.kind !== "shelf") throw new Error("thiếu kệ trong fixture");
    await saveShelf("wh-1", { ...shelf, id: null, code: "c01" }, null);
    const body = lastBody("post");
    expect(body.code).toBe("C01");
    for (const key of GONE) expect(body).not.toHaveProperty(key);
  });

  it("khu chứa hàng: location chỉ còn tải trọng và cờ lấy / cất hàng", async () => {
    if (area?.kind !== "area") throw new Error("thiếu khu vực trong fixture");
    await saveArea("wh-1", { ...area, location: { ...area.location, maxWeight: 900 } });
    const location = lastBody("put").location as Record<string, unknown>;
    expect(location).toEqual({ maxWeight: 900, pickable: false, putawayTarget: false });
  });

  it("sinh bin: defaults không còn storageClassOverride / capacityUnits", async () => {
    await generateShelfBins("shelf-1", ["level-1"], DEFAULT_SHELF_BUILD, "key-1").catch(() => {
      // Phản hồi giả không phải mảng bin — chỉ kiểm tra body đã gửi
    });
    const defaults = lastBody("post").defaults as Record<string, unknown>;
    for (const key of GONE) expect(defaults).not.toHaveProperty(key);
    expect(wireKeys(defaults)).toEqual(["pickable", "putawayTarget", "type"].sort());
  });
});
