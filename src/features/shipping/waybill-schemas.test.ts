import { describe, expect, it } from "vitest";

import {
  beWaybillChangeSchema,
  beWaybillHistorySchema,
  beWaybillImportLineSchema,
  beWaybillImportPageSchema,
  beWaybillImportSchema,
} from "./waybill-schemas";

const change = {
  oldWaybillNo: "GHN-1",
  newWaybillNo: "GHN-2",
  source: "MANUAL",
  changedBy: "u1",
  changedByName: "Quản lý kho",
  changedAt: "2026-11-10T03:00:00Z",
  reason: "Nhập nhầm",
};

describe("beWaybillChangeSchema — lịch sử đổi mã vận đơn", () => {
  it("parse đủ trường", () => {
    expect(beWaybillChangeSchema.parse(change)).toMatchObject({
      oldWaybillNo: "GHN-1",
      newWaybillNo: "GHN-2",
      source: "MANUAL",
      reason: "Nhập nhầm",
    });
  });

  it("BE bỏ null: lần đặt đầu không có mã cũ, webhook không có người đổi, đặt xe huỷ không có mã mới", () => {
    const first = beWaybillChangeSchema.parse({
      newWaybillNo: "GHN-1",
      source: "WEBHOOK",
      changedAt: "2026-11-10T03:00:00Z",
    });
    expect(first.oldWaybillNo).toBeUndefined();
    expect(first.changedBy).toBeUndefined();
    expect(first.reason).toBeUndefined();
    const cleared = beWaybillChangeSchema.parse({
      oldWaybillNo: "GHN-1",
      source: "API",
      changedAt: "2026-11-10T03:00:00Z",
    });
    expect(cleared.newWaybillNo).toBeUndefined();
  });

  it("nguồn lạ → UNKNOWN; thời điểm sai định dạng hoặc thiếu → lỗi", () => {
    expect(beWaybillChangeSchema.parse({ ...change, source: "CARRIER_PIGEON" }).source).toBe(
      "UNKNOWN",
    );
    expect(() => beWaybillChangeSchema.parse({ ...change, changedAt: "hôm qua" })).toThrow();
    const { changedAt: _changedAt, ...missing } = change;
    expect(() => beWaybillChangeSchema.parse(missing)).toThrow();
  });

  it("lịch sử là mảng các lần đổi", () => {
    expect(beWaybillHistorySchema.parse([change, change])).toHaveLength(2);
    expect(beWaybillHistorySchema.parse([])).toEqual([]);
  });
});

describe("beWaybillImportLineSchema — một dòng của file", () => {
  it("parse dòng hợp lệ; ô trống của file vắng hết", () => {
    const line = beWaybillImportLineSchema.parse({ line: 2, outcome: "NEW" });
    expect(line).toMatchObject({ line: 2, outcome: "NEW" });
    expect(line.waybillNo).toBeUndefined();
    expect(line.problem).toBeUndefined();
  });

  it("dòng lỗi: lý do + chuyến đang giữ mã; lý do / kết quả lạ → UNKNOWN", () => {
    const line = beWaybillImportLineSchema.parse({
      line: 3,
      loadCode: "LD-1",
      waybillNo: "GHN-1",
      outcome: "ERROR",
      problem: "DUPLICATE_IN_CARRIER",
      holderCode: "LD-9",
    });
    expect(line).toMatchObject({ problem: "DUPLICATE_IN_CARRIER", holderCode: "LD-9" });
    const strange = beWaybillImportLineSchema.parse({
      line: 4,
      outcome: "MAYBE",
      problem: "NEW_ONE",
    });
    expect(strange).toMatchObject({ outcome: "UNKNOWN", problem: "UNKNOWN" });
  });

  it("số dòng phải là số nguyên ≥ 1 (dòng tiêu đề là dòng 1)", () => {
    expect(() => beWaybillImportLineSchema.parse({ line: 0, outcome: "NEW" })).toThrow();
    expect(() => beWaybillImportLineSchema.parse({ line: 1.5, outcome: "NEW" })).toThrow();
    expect(() => beWaybillImportLineSchema.parse({ outcome: "NEW" })).toThrow();
  });
});

describe("beWaybillImportSchema — xem trước / kết quả nhập", () => {
  const preview = {
    rowsTotal: 2,
    rowsApplied: 1,
    rowsRejected: 1,
    lines: [
      { line: 2, outcome: "NEW", loadCode: "LD-1", waybillNo: "GHN-1" },
      { line: 3, outcome: "ERROR", problem: "LOAD_NOT_FOUND" },
    ],
  };

  it("xem trước không có importId (chưa ghi gì)", () => {
    const parsed = beWaybillImportSchema.parse(preview);
    expect(parsed.importId).toBeUndefined();
    expect(parsed.lines.map((l) => l.outcome)).toEqual(["NEW", "ERROR"]);
    expect(parsed).toMatchObject({ rowsTotal: 2, rowsApplied: 1, rowsRejected: 1 });
  });

  it("kết quả đã nhập có importId, tên file, người tải và thời điểm", () => {
    const parsed = beWaybillImportSchema.parse({
      ...preview,
      importId: "imp-1",
      fileName: "waybills.csv",
      uploadedBy: "u1",
      uploadedAt: "2026-11-10T03:00:00Z",
    });
    expect(parsed).toMatchObject({ importId: "imp-1", fileName: "waybills.csv" });
  });

  it("thiếu số dòng hoặc mảng dòng → lỗi", () => {
    const { lines: _lines, ...noLines } = preview;
    expect(() => beWaybillImportSchema.parse(noLines)).toThrow();
    const { rowsTotal: _rowsTotal, ...noTotal } = preview;
    expect(() => beWaybillImportSchema.parse(noTotal)).toThrow();
  });
});

describe("beWaybillImportPageSchema — danh sách các lần nhập", () => {
  it("parse trang; importId là bắt buộc ở từng dòng", () => {
    const row = { importId: "imp-1", rowsTotal: 3, rowsApplied: 3, rowsRejected: 0 };
    const page = (items: unknown[]) => ({
      items,
      page: 0,
      size: 15,
      totalElements: items.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(beWaybillImportPageSchema.parse(page([row])).items[0]).toMatchObject({
      importId: "imp-1",
      rowsApplied: 3,
    });
    const { importId: _importId, ...noId } = row;
    expect(() => beWaybillImportPageSchema.parse(page([noId]))).toThrow();
  });
});
