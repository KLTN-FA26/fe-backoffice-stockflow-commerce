/**
 * Chạy kế hoạch lưu bản nháp tuần tự (`draft-plan.ts`). Mỗi request xong được ghi lại ngay; hỏng giữa
 * chừng thì dừng và ném `DraftSaveError` kèm phần đã lưu — màn hình ghi nhận phần đó vào bản nháp, phần
 * còn lại vẫn chờ lưu lần sau. Kệ mới = tạo kệ → tạo tầng 1..N → tự sinh bin (docs 06 §4.1 bước 5–7).
 */

import { LOCATION_STATUS } from "@/constants";
import { api } from "@/lib/api/client";
import { newIdempotencyKey } from "@/lib/api/idempotency";

import { addShelfLevel, changePlaceStatus, deleteBoundary, generateShelfBins } from "./api";
import { saveArea, saveBoundary, saveShelf, saveZone } from "./api-draft";
import { planDraftSave, saveOpLabel } from "./draft-plan";
import { savedRefDto } from "./schemas";

import type { DraftShelf, MapDraft } from "./draft";
import type { SavedRef } from "./draft-edit";
import type { SaveOp } from "./draft-plan";

export interface DraftSaveResult {
  saved: SavedRef[];
  removedKeys: string[];
}

export class DraftSaveError extends Error {
  readonly result: DraftSaveResult;
  readonly step: string;
  readonly cause: unknown;
  constructor(result: DraftSaveResult, step: string, cause: unknown) {
    super(step);
    this.name = "DraftSaveError";
    this.result = result;
    this.step = step;
    this.cause = cause;
  }
}

export interface SaveDraftInput {
  warehouseId: string;
  draft: MapDraft;
  onProgress?: (done: number, total: number) => void;
}

const shelfVersion = async (shelfId: string): Promise<number> => {
  const { data } = await api.get<unknown>(`/shelves/${encodeURIComponent(shelfId)}`);
  return savedRefDto.parse(data).version;
};

/**
 * Tầng + bin của kệ vừa tạo (hoặc dựng dở lần trước — tiếp từ `builtLevelIds`). Tạo tầng làm đổi
 * `version` kệ → đọc lại để lần PUT sau không bị 409. Hỏng giữa chừng: ghi các tầng đã tạo vào
 * `saved.pendingLevelIds` + version mới nhất đọc được (cố gắng, không chắc) rồi ném tiếp — bản nháp giữ
 * phần còn thiếu để lần lưu sau dựng tiếp.
 */
async function buildShelf(saved: SavedRef, shelf: DraftShelf): Promise<void> {
  const build = shelf.build;
  if (!build || build.levelCount === 0) return;
  const levelIds = [...(shelf.builtLevelIds ?? [])];
  try {
    for (let index = levelIds.length + 1; index <= build.levelCount; index += 1)
      levelIds.push((await addShelfLevel(saved.id, index, build.levelHeight)).id);
    // BR-14: gửi Idempotency-Key — thử lại không bị 409 SHELF_LEVEL_HAS_BINS
    if (build.generateBins) await generateShelfBins(saved.id, levelIds, build, newIdempotencyKey());
  } catch (error) {
    saved.pendingLevelIds = levelIds;
    saved.version = await shelfVersion(saved.id).catch(() => saved.version);
    throw error;
  }
  saved.version = await shelfVersion(saved.id);
}

async function runOp(
  op: SaveOp,
  input: SaveDraftInput,
  zoneIds: Map<string, string>,
  result: DraftSaveResult,
): Promise<void> {
  const { warehouseId } = input;
  switch (op.type) {
    case "zone": {
      const ref = await saveZone(warehouseId, op.zone);
      zoneIds.set(op.zone.key, ref.id);
      result.saved.push({ key: op.zone.key, id: ref.id, version: ref.version });
      return;
    }
    case "remove": {
      const { item } = op;
      if (item.id === null) return;
      // BR-04 (docs 06 §6): tường / cửa xoá hẳn; kệ / khu vực không xoá, chỉ chuyển Inactive
      if (item.kind === "boundary") await deleteBoundary(item.id, item.version);
      else
        await changePlaceStatus({ kind: item.kind, id: item.id, status: LOCATION_STATUS.INACTIVE });
      result.removedKeys.push(item.key);
      return;
    }
    case "shelf": {
      const zoneId = op.item.zoneKey ? (zoneIds.get(op.item.zoneKey) ?? null) : null;
      const ref = await saveShelf(warehouseId, op.item, zoneId);
      const saved: SavedRef = { key: op.item.key, id: ref.id, version: ref.version };
      // Ghi nhận kệ ngay: tầng / bin hỏng sau đó thì kệ vẫn đã có trên bản đồ
      result.saved.push(saved);
      // Chỉ kệ mới hoặc kệ dựng dở còn `build`
      await buildShelf(saved, op.item);
      return;
    }
    case "area":
    case "boundary": {
      const ref =
        op.type === "area"
          ? await saveArea(warehouseId, op.item)
          : await saveBoundary(warehouseId, op.item);
      result.saved.push({ key: op.item.key, id: ref.id, version: ref.version });
      return;
    }
  }
}

export async function saveMapDraft(input: SaveDraftInput): Promise<DraftSaveResult> {
  const { draft, onProgress } = input;
  const ops = planDraftSave(draft);
  const zoneIds = new Map(draft.zones.flatMap((zone) => (zone.id ? [[zone.key, zone.id]] : [])));
  const result: DraftSaveResult = { saved: [], removedKeys: [] };
  for (const [index, op] of ops.entries()) {
    onProgress?.(index, ops.length);
    try {
      await runOp(op, input, zoneIds, result);
    } catch (cause) {
      throw new DraftSaveError(result, saveOpLabel(op), cause);
    }
  }
  onProgress?.(ops.length, ops.length);
  return result;
}
