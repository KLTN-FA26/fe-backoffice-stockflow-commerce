import { beforeEach, describe, expect, it, vi } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { saveArea, saveBoundary, saveShelf, saveZone } from "./api-draft";
import { addShelfLevel, changePlaceStatus, deleteBoundary, generateShelfBins } from "./api";
import { draftFromLayout } from "./draft";
import { draftReducer } from "./draft-edit";
import { DraftSaveError, saveMapDraft } from "./draft-save";

import type { DraftAction } from "./draft-edit";

vi.mock("./api-draft", () => ({
  saveZone: vi.fn(),
  saveShelf: vi.fn(),
  saveArea: vi.fn(),
  saveBoundary: vi.fn(),
}));
vi.mock("./api", () => ({
  addShelfLevel: vi.fn(),
  generateShelfBins: vi.fn(),
  changePlaceStatus: vi.fn(),
  deleteBoundary: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(async () => ({ data: { id: "shelf-new", version: 3 } })) },
}));

const apply = (...actions: DraftAction[]) => actions.reduce(draftReducer, draftFromLayout(LAYOUT));
const NEW_SHELF: DraftAction = {
  type: "draw",
  shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveZone).mockResolvedValue({ id: "zone-new", version: 0 });
  vi.mocked(saveShelf).mockResolvedValue({ id: "shelf-new", version: 0 });
  vi.mocked(saveArea).mockResolvedValue({ id: "area-x", version: 1 });
  vi.mocked(saveBoundary).mockResolvedValue({ id: "wall-x", version: 0 });
  vi.mocked(addShelfLevel).mockImplementation(async (_id, index) => ({ id: `level-${index}` }));
  vi.mocked(generateShelfBins).mockResolvedValue([]);
  vi.mocked(changePlaceStatus).mockResolvedValue({ id: "shelf-a01" });
  vi.mocked(deleteBoundary).mockResolvedValue(undefined);
});

describe("lưu bản nháp tuần tự", () => {
  it("kệ mới = tạo kệ (gắn zone vừa tạo) → tạo từng tầng → tự sinh bin; đọc lại version kệ", async () => {
    const draft = apply({ type: "addZone", name: "Khu C", color: null }, NEW_SHELF);
    const shelfKey = draft.items.at(-1)?.key ?? "";
    const zoneKey = draft.zones.at(-1)?.key ?? "";
    const withZone = draftReducer(draft, {
      type: "update",
      key: shelfKey,
      apply: (item) => (item.kind === "shelf" ? { ...item, zoneKey } : item),
    });
    const result = await saveMapDraft({ warehouseId: "wh-hcm", draft: withZone });
    expect(vi.mocked(saveShelf).mock.calls[0]?.[2]).toBe("zone-new");
    expect(vi.mocked(addShelfLevel).mock.calls.map((call) => call[1])).toEqual([1, 2]);
    expect(vi.mocked(generateShelfBins).mock.calls[0]?.[1]).toEqual(["level-1", "level-2"]);
    expect(result.saved).toContainEqual({ key: shelfKey, id: "shelf-new", version: 3 });
  });

  it("BR-04: kệ đã lưu bị xoá → chuyển Inactive, tường đã lưu bị xoá → DELETE", async () => {
    const draft = apply({ type: "remove", key: "shelf-a01" }, { type: "remove", key: "wall-n" });
    const result = await saveMapDraft({ warehouseId: "wh-hcm", draft });
    expect(changePlaceStatus).toHaveBeenCalledWith({
      kind: "shelf",
      id: "shelf-a01",
      status: "INACTIVE",
    });
    // BE bắt buộc version khi xoá hẳn (thiếu → 400 VALIDATION_FAILED)
    expect(deleteBoundary).toHaveBeenCalledWith("wall-n", 0);
    expect(result.removedKeys.sort()).toEqual(["shelf-a01", "wall-n"]);
  });

  it("hỏng giữa chừng → dừng, báo bước hỏng, giữ phần đã lưu để lần sau không gửi lại", async () => {
    vi.mocked(saveShelf).mockRejectedValueOnce(new Error("409"));
    const draft = apply({ type: "remove", key: "wall-n" }, NEW_SHELF, {
      type: "draw",
      shape: { kind: "wall", line: { startX: 0, startY: 5, endX: 0, endY: 9 } },
    });
    const error = await saveMapDraft({ warehouseId: "wh-hcm", draft }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DraftSaveError);
    if (!(error instanceof DraftSaveError)) return;
    expect(error.step).toBe("Tạo kệ K01");
    expect(error.result.removedKeys).toEqual(["wall-n"]);
    expect(saveBoundary).not.toHaveBeenCalled();
  });
});
