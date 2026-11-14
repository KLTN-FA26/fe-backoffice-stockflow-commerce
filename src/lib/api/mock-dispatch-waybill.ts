/**
 * Mock mã vận đơn theo chuyến (BE `LoadWaybillController`, `WaybillImportController`; docs 09 §4.4): nhập tay / sửa sau khi
 * rời kho, lịch sử, xem trước + nhập file CSV theo mẫu. Mã lỗi đúng BE: 409 INVALID_LOAD_TRANSITION (chưa đặt xe / đã huỷ),
 * WAYBILL_FROM_CARRIER_API, WAYBILL_DUPLICATE; 400 VALIDATION_FAILED, WAYBILL_IMPORT_INVALID_FILE.
 */

import { MOCK_DISPATCHER, type DispatchState, type MockLoad } from "./mock-dispatch-store";
import { waybillHeldBy } from "./mock-dispatch-booking";
import { loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { MockResponseShape } from "./mock-route-utils";

const WAYBILL = /^[!-~]{1,64}$/;
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();

/** Nhập tay / sửa mã vận đơn. `canCorrect`: người gọi có `fulfillment-waybill-corrections:UPDATE` (BR-24). */
export function recordWaybill(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
  canCorrect: boolean,
): MockResponseShape {
  const carrier = state.carriers.find((c) => c.carrierId === load.carrierId);
  if (load.status === "PLANNED" || load.status === "CANCELLED" || !carrier) {
    return fail(
      409,
      "INVALID_LOAD_TRANSITION",
      `Load ${load.code} has no carrier booked (or is cancelled): book the vehicle first`,
    );
  }
  if (carrier.connectionType === "API_BOOKING") {
    return fail(
      409,
      "WAYBILL_FROM_CARRIER_API",
      `Carrier ${carrier.code} gives the waybill number when the vehicle is booked through its API`,
    );
  }
  const waybillNo = text(body.waybillNo);
  if (!WAYBILL.test(waybillNo))
    return validationFailed("waybillNo", "1-64 printable characters, no spaces");
  const dispatched = load.status === "DISPATCHED";
  // BR-24: sau khi rời kho chỉ quản lý kho sửa — một mã quyền, không phải vai trò
  if (dispatched && !canCorrect) return fail(403, "FORBIDDEN", "Access denied");
  const plate = "vehiclePlate" in body ? text(body.vehiclePlate) || null : load.vehiclePlate;
  const driver = "driverName" in body ? text(body.driverName) || null : load.driverName;
  const phone = "driverPhone" in body ? text(body.driverPhone) || null : load.driverPhone;
  if (
    waybillNo === load.waybillNo &&
    plate === load.vehiclePlate &&
    driver === load.driverName &&
    phone === load.driverPhone
  ) {
    return ok(loadDetailView(state, load));
  }
  const reason = text(body.reason) || null;
  if (dispatched && !reason) return validationFailed("reason", "correcting a waybill says why");
  if (
    dispatched &&
    (plate !== load.vehiclePlate || driver !== load.driverName || phone !== load.driverPhone)
  ) {
    return validationFailed("vehiclePlate", "a correction changes the waybill number only");
  }
  if (load.carrierId && waybillHeldBy(state, load, load.carrierId, waybillNo)) {
    return fail(
      409,
      "WAYBILL_DUPLICATE",
      `Another load of ${carrier.code} has waybill number ${waybillNo}`,
    );
  }
  if (waybillNo !== load.waybillNo) {
    load.waybillHistory.push({
      oldWaybillNo: load.waybillNo,
      newWaybillNo: waybillNo,
      source: "MANUAL",
      changedByName: MOCK_DISPATCHER,
      changedAt: stamp(),
      reason,
    });
  }
  load.waybillNo = waybillNo;
  load.vehiclePlate = plate;
  load.driverName = driver;
  load.driverPhone = phone;
  load.version += 1;
  return ok(loadDetailView(state, load));
}

/** Lịch sử mã vận đơn, cũ nhất trước (BE `WaybillChangeResponse`). */
export function waybillHistory(load: MockLoad): MockResponseShape {
  return ok(load.waybillHistory);
}

/* ── Nhập file ───────────────────────────────────────────────────────── */

const HEADINGS = ["Mã chuyến", "Mã vận đơn", "Biển số", "Tên tài xế", "Điện thoại tài xế"];
export const IMPORT_TEMPLATE = `﻿${HEADINGS.join(",")}\n`;

interface ImportLine {
  line: number;
  loadCode: string | null;
  waybillNo: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  loadId: string | null;
  outcome: "NEW" | "OVERWRITE" | "SAME" | "ERROR";
  problem: string | null;
  holderCode: string | null;
}

/** Đọc nội dung file: `File.text()` của trình duyệt; jsdom (test) chưa có thì qua `FileReader`. */
export async function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Tách dòng theo dấu phân cách nhiều dòng nhất (`;` / tab / `,` — như BE `WaybillImportFile`); dòng đầu là tiêu đề. */
function rowsOf(content: string): string[][] | null {
  const lines = content
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1 }));
  const data = lines.slice(1).filter(({ raw }) => raw.trim() !== "");
  if (lines.length < 2 || data.length === 0 || data.length > 1000) return null;
  const delimiter =
    [";", "\t", ","].sort(
      (a, b) =>
        data.filter(({ raw }) => raw.includes(b)).length -
        data.filter(({ raw }) => raw.includes(a)).length,
    )[0] ?? ",";
  return data.map(({ raw, line }) => [String(line), ...raw.split(delimiter).map((c) => c.trim())]);
}

/** Dòng đã đọc: phần kiểm riêng của từng dòng (BE `WaybillImportCheck.early`) trước khi nhìn các dòng khác. */
interface ReadRow {
  row: ImportLine;
  load: MockLoad | undefined;
  early: string | null;
}

function readRow(state: DispatchState, cells: string[]): ReadRow {
  const [line, loadCode, waybillNo, plate, driver, phone] = cells;
  const row: ImportLine = {
    line: Number(line),
    loadCode: loadCode || null,
    waybillNo: waybillNo || null,
    vehiclePlate: plate || null,
    driverName: driver || null,
    driverPhone: phone || null,
    loadId: null,
    outcome: "ERROR",
    problem: null,
    holderCode: null,
  };
  const load = loadCode ? [...state.loads.values()].find((l) => l.code === loadCode) : undefined;
  row.loadId = load?.loadId ?? null;
  let early: string | null = null;
  if (!loadCode || !waybillNo) early = "MISSING_FIELDS";
  else if (!WAYBILL.test(waybillNo)) early = "INVALID_WAYBILL";
  else if ((plate?.length ?? 0) > 20 || (driver?.length ?? 0) > 120 || (phone?.length ?? 0) > 32)
    early = "INVALID_VEHICLE_DETAILS";
  else if (!load) early = "LOAD_NOT_FOUND";
  return { row, load, early };
}

/**
 * Kiểm một dòng theo đúng thứ tự BE `WaybillImportCheck.verdict`. Dòng lặp (cùng chuyến, hoặc cùng mã vận đơn của cùng hãng)
 * bị đánh lỗi Ở MỌI DÒNG LẶP, kể cả dòng đầu — BE đếm trên cả file trước khi phán từng dòng.
 */
function verdict(
  state: DispatchState,
  { row, load, early }: ReadRow,
  perLoad: Map<string, number>,
  perNumber: Map<string, number>,
): ImportLine {
  const reject = (problem: string, holder?: string): ImportLine => ({
    ...row,
    outcome: "ERROR",
    problem,
    holderCode: holder ?? null,
  });
  if (early || !load || !row.waybillNo) return reject(early ?? "MISSING_FIELDS");
  if ((perLoad.get(load.loadId) ?? 0) > 1) return reject("LOAD_REPEATED");
  if (load.status === "CANCELLED") return reject("LOAD_CANCELLED");
  if (load.status === "DISPATCHED") return reject("LOAD_LEFT");
  const carrier = state.carriers.find((c) => c.carrierId === load.carrierId);
  if (load.status === "PLANNED" || !carrier) return reject("LOAD_NOT_BOOKED");
  if (carrier.connectionType === "API_BOOKING") return reject("WAYBILL_FROM_CARRIER_API");
  if ((perNumber.get(`${carrier.carrierId}|${row.waybillNo}`) ?? 0) > 1)
    return reject("DUPLICATE_IN_FILE");
  const holder = waybillHeldBy(state, load, carrier.carrierId, row.waybillNo);
  if (holder) return reject("DUPLICATE_IN_CARRIER", holder.code);
  if (load.waybillNo === row.waybillNo) return { ...row, outcome: "SAME" };
  return { ...row, outcome: load.waybillNo ? "OVERWRITE" : "NEW" };
}

export async function checkImport(
  state: DispatchState,
  file: Blob | null,
): Promise<{ lines: ImportLine[] } | MockResponseShape> {
  const invalid = () =>
    fail(
      400,
      "WAYBILL_IMPORT_INVALID_FILE",
      "This file cannot be read as the waybill import template",
    );
  if (!file || file.size === 0 || file.size > 1024 * 1024) return invalid();
  const rows = rowsOf(await readFileText(file));
  if (!rows) return invalid();
  const read = rows.map((cells) => readRow(state, cells));
  const perLoad = new Map<string, number>();
  const perNumber = new Map<string, number>();
  for (const { row, load, early } of read) {
    if (early || !load) continue;
    perLoad.set(load.loadId, (perLoad.get(load.loadId) ?? 0) + 1);
    if (load.carrierId) {
      const key = `${load.carrierId}|${row.waybillNo}`;
      perNumber.set(key, (perNumber.get(key) ?? 0) + 1);
    }
  }
  return { lines: read.map((entry) => verdict(state, entry, perLoad, perNumber)) };
}

const summary = (lines: ImportLine[], applied: number) => ({
  rowsTotal: lines.length,
  rowsApplied: applied,
  rowsRejected: lines.filter((l) => l.outcome === "ERROR").length,
});

/** Xem trước: không ghi gì; `rowsApplied` = số dòng hợp lệ (mới, không đổi, sẽ ghi đè) — BE `Verdict.applies()` = không lỗi. */
export function previewResponse(lines: ImportLine[], fileName: string): MockResponseShape {
  return ok({
    fileName,
    ...summary(lines, lines.filter((l) => l.outcome !== "ERROR").length),
    lines,
  });
}

/** Nhập file: áp các dòng mới và dòng ghi đè được xác nhận (BR-25); dòng ghi đè chưa xác nhận → OVERWRITE_NOT_CONFIRMED. */
export function applyImport(
  state: DispatchState,
  lines: ImportLine[],
  fileName: string,
  overwrite: ReadonlySet<number>,
): MockResponseShape {
  let applied = 0;
  const result = lines.map((line): ImportLine => {
    const load = line.loadId ? state.loads.get(line.loadId) : undefined;
    if (!load || line.outcome === "ERROR" || line.outcome === "SAME") return line;
    if (line.outcome === "OVERWRITE" && !overwrite.has(line.line)) {
      return { ...line, outcome: "ERROR", problem: "OVERWRITE_NOT_CONFIRMED" };
    }
    load.waybillHistory.push({
      oldWaybillNo: load.waybillNo,
      newWaybillNo: line.waybillNo,
      source: "FILE",
      changedByName: MOCK_DISPATCHER,
      changedAt: stamp(),
      reason: null,
    });
    load.waybillNo = line.waybillNo;
    // Cột để trống: chuyến giữ biển số / tài xế đang có
    load.vehiclePlate = line.vehiclePlate ?? load.vehiclePlate;
    load.driverName = line.driverName ?? load.driverName;
    load.driverPhone = line.driverPhone ?? load.driverPhone;
    load.version += 1;
    applied += 1;
    return line;
  });
  return ok(
    {
      importId: `imp-${Date.now()}`,
      fileName,
      uploadedAt: stamp(),
      ...summary(result, applied),
      lines: result,
    },
    201,
  );
}
