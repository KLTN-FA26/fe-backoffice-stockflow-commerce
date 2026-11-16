/**
 * Contract mock mã vận đơn theo chuyến, nhập file và danh mục hãng (BE `LoadWaybillController`, `WaybillImportController`,
 * `CarrierController`; docs 09 §4.1, §4.4, BR-23–25, BR-29): chạy handler mock thật qua `resolveMockRoute`, parse bằng schema FE.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
} from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { resetDispatchMockStore } from "@/lib/api/mock-dispatch-store";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beLoadSchema } from "./load-schemas";
import { beCarrierPageSchema, beCarrierSchema } from "./schemas";
import { beWaybillHistorySchema, beWaybillImportSchema } from "./waybill-schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerDispatchMockRoutes();

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined || data instanceof FormData ? data : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

const DISPATCH = FULFILLMENT_DISPATCH_PERMISSIONS.update;
const IMPORT = FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS;
const CORRECTION = FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS.update;
const CARRIERS_UPDATE = FULFILLMENT_CARRIER_PERMISSIONS.update;
const STAFF: PermissionCode[] = [DISPATCH, IMPORT.read, IMPORT.create];
const MANAGER: PermissionCode[] = [...STAFF, CORRECTION, CARRIERS_UPDATE];

function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
  });
}

const LOADS = "/fulfillment/loads";
const IMPORTS = "/fulfillment/waybill-imports";
const CARRIERS = "/fulfillment/carriers";
// Seed `mock-dispatch-ftl-store.ts`
const PLANNED = "LD-2026-F003";
const BOOKED_VTP = "LD-2026-F002";
const LOADING_GHN = "LD-2026-F001";
const CANCELLED = "LD-2026-F004";
const DISPATCHED = "LD-2026-F006";
const GHN = "CAR-GHN";
const API_CARRIER = "carrier-api-booking";

interface ErrorBody {
  errorCode?: string;
  fieldErrors?: { field: string; message: string }[];
}
const errorBody = (res: { data: unknown }) => res.data as ErrorBody;
const errorCode = (res: { data: unknown }) => errorBody(res).errorCode;
const errorField = (res: { data: unknown }) => errorBody(res).fieldErrors?.[0]?.field;

const putWaybill = (id: string, body: Record<string, unknown>) =>
  call("PUT", `${LOADS}/${id}/waybill`, body);
const readLoad = async (id: string) =>
  beLoadSchema.parse((await call("GET", `${LOADS}/${id}`)).data);
const history = async (id: string) =>
  beWaybillHistorySchema.parse((await call("GET", `${LOADS}/${id}/waybill-history`)).data);
const book = (id: string, body: Record<string, unknown>) =>
  call("POST", `${LOADS}/${id}/booking`, body);

beforeEach(() => {
  resetDispatchMockStore();
  actAs(MANAGER);
});

describe("mock PUT /loads/{id}/waybill — nhập tay mã vận đơn", () => {
  it("xe đã đặt chưa có mã: lưu mã + biển số + tài xế, lịch sử MANUAL; gửi lại y hệt không đổi gì; chỉ đổi biển số không ghi lịch sử", async () => {
    const before = await readLoad(BOOKED_VTP);
    expect(before.waybillNo).toBeUndefined();
    const body = {
      waybillNo: "VTP-0001",
      vehiclePlate: "51D-111.11",
      driverName: "Nguyễn Văn A",
      driverPhone: "0901 000 111",
    };
    const saved = beLoadSchema.parse((await putWaybill(BOOKED_VTP, body)).data);
    expect(saved).toMatchObject({ ...body, status: "VEHICLE_BOOKED" });
    expect(saved.version).toBe(before.version + 1);
    const entries = await history(BOOKED_VTP);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ newWaybillNo: "VTP-0001", source: "MANUAL" });
    expect(entries[0]?.oldWaybillNo).toBeUndefined();

    const again = beLoadSchema.parse((await putWaybill(BOOKED_VTP, body)).data);
    expect(again.version).toBe(saved.version);
    expect(await history(BOOKED_VTP)).toHaveLength(1);

    const plateOnly = beLoadSchema.parse(
      (await putWaybill(BOOKED_VTP, { waybillNo: "VTP-0001", vehiclePlate: "51D-222.22" })).data,
    );
    expect(plateOnly).toMatchObject({ waybillNo: "VTP-0001", vehiclePlate: "51D-222.22" });
    // Cột không gửi giữ nguyên
    expect(plateOnly.driverName).toBe("Nguyễn Văn A");
    expect(await history(BOOKED_VTP)).toHaveLength(1);
    // Đổi mã khi chuyến chưa rời kho: lịch sử có mã cũ → mới, không cần lý do
    await putWaybill(BOOKED_VTP, { waybillNo: "VTP-0002" });
    expect((await history(BOOKED_VTP)).at(-1)).toMatchObject({
      oldWaybillNo: "VTP-0001",
      newWaybillNo: "VTP-0002",
    });
  });

  it("chưa đặt xe hoặc đã huỷ → 409 INVALID_LOAD_TRANSITION; mã không hợp lệ → 400 nêu ô waybillNo; không có chuyến → 404", async () => {
    for (const id of [PLANNED, CANCELLED]) {
      const refused = await putWaybill(id, { waybillNo: "GHN-1" });
      expect(refused.status).toBe(409);
      expect(errorCode(refused)).toBe("INVALID_LOAD_TRANSITION");
    }
    for (const waybillNo of ["", "GHN 1", "GHN\t1", "x".repeat(65)]) {
      const refused = await putWaybill(LOADING_GHN, { waybillNo });
      expect(refused.status, JSON.stringify(waybillNo)).toBe(400);
      expect(errorCode(refused)).toBe("VALIDATION_FAILED");
      expect(errorField(refused)).toBe("waybillNo");
    }
    expect((await readLoad(LOADING_GHN)).waybillNo).toBe("GHN-250001");
    expect((await putWaybill("LD-NOPE", { waybillNo: "X-1" })).status).toBe(404);
  });

  it("trùng mã trong cùng hãng → 409 WAYBILL_DUPLICATE (BR-23); chính chuyến đang giữ mã gửi lại thì không trùng", async () => {
    await book(PLANNED, { carrierId: GHN, vehiclePlate: "51C-1" });
    const dup = await putWaybill(PLANNED, { waybillNo: "GHN-250001" });
    expect(dup.status).toBe(409);
    expect(errorCode(dup)).toBe("WAYBILL_DUPLICATE");
    expect((await readLoad(PLANNED)).waybillNo).toBeUndefined();
    expect((await putWaybill(LOADING_GHN, { waybillNo: "GHN-250001" })).status).toBe(200);
    // Chuyến đã huỷ giải phóng mã của nó
    const state = await import("@/lib/api/mock-dispatch-store").then((m) => m.getDispatchState());
    const held = state.loads.get(LOADING_GHN);
    if (held) held.status = "CANCELLED";
    expect((await putWaybill(PLANNED, { waybillNo: "GHN-250001" })).status).toBe(200);
  });

  it("hãng đặt xe qua API không nhập tay → 409 WAYBILL_FROM_CARRIER_API; lịch sử ghi nguồn API, không có dòng MANUAL", async () => {
    const stops = (await readLoad(PLANNED)).shipments.map((s) => s.shipmentId);
    await book(PLANNED, { carrierId: API_CARRIER, stopShipmentIds: stops });
    const refused = await putWaybill(PLANNED, { waybillNo: "TAY-1" });
    expect(refused.status).toBe(409);
    expect(errorCode(refused)).toBe("WAYBILL_FROM_CARRIER_API");
    const entries = await history(PLANNED);
    expect(entries.map((e) => e.source)).toEqual(["API"]);
    expect(entries[0]?.newWaybillNo).toBe((await readLoad(PLANNED)).waybillNo);
  });

  it("sau khi rời kho là SỬA mã (BR-24): cần fulfillment-waybill-corrections:UPDATE + lý do, không đổi biển số / tài xế, lưu lịch sử kèm lý do", async () => {
    const left = await readLoad(DISPATCHED);
    expect(left).toMatchObject({ status: "DISPATCHED", waybillNo: "GHN-250000" });
    // Nhân viên kho (chỉ dispatch) và người chỉ có quyền sửa nhưng không có dispatch đều bị chặn
    actAs([DISPATCH]);
    expect(
      await putWaybill(DISPATCHED, { waybillNo: "GHN-FIX-1", reason: "Nhập nhầm" }),
    ).toMatchObject({
      status: 403,
    });
    actAs([CORRECTION]);
    expect(
      (await putWaybill(DISPATCHED, { waybillNo: "GHN-FIX-1", reason: "Nhập nhầm" })).status,
    ).toBe(403);

    actAs([DISPATCH, CORRECTION]);
    const noReason = await putWaybill(DISPATCHED, { waybillNo: "GHN-FIX-1" });
    expect(noReason.status).toBe(400);
    expect(errorField(noReason)).toBe("reason");
    const withPlate = await putWaybill(DISPATCHED, {
      waybillNo: "GHN-FIX-1",
      vehiclePlate: "51D-000.00",
      reason: "Nhập nhầm",
    });
    expect(withPlate.status).toBe(400);
    expect(errorField(withPlate)).toBe("vehiclePlate");
    expect(
      (await putWaybill(DISPATCHED, { waybillNo: "GHN-250001", reason: "Nhập nhầm" })).status,
    ).toBe(409);
    expect((await readLoad(DISPATCHED)).waybillNo).toBe("GHN-250000");

    // Gửi lại đúng biển số hiện tại không tính là đổi biển số
    const fixed = beLoadSchema.parse(
      (
        await putWaybill(DISPATCHED, {
          waybillNo: "GHN-FIX-1",
          vehiclePlate: left.vehiclePlate,
          reason: "Hãng cấp lại mã",
        })
      ).data,
    );
    expect(fixed).toMatchObject({ status: "DISPATCHED", waybillNo: "GHN-FIX-1" });
    expect(fixed.vehiclePlate).toBe(left.vehiclePlate);
    expect(fixed.version).toBe(left.version + 1);
    expect((await history(DISPATCHED)).at(-1)).toMatchObject({
      oldWaybillNo: "GHN-250000",
      newWaybillNo: "GHN-FIX-1",
      source: "MANUAL",
      reason: "Hãng cấp lại mã",
    });
  });

  it("lịch sử đọc không cần quyền ghi: cũ nhất trước, xe chưa có thay đổi → []; không có chuyến → 404", async () => {
    actAs([]);
    const entries = await history(LOADING_GHN);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ newWaybillNo: "GHN-250001", source: "MANUAL" });
    expect(entries[0]?.changedByName).toEqual(expect.any(String));
    expect(await history(PLANNED)).toEqual([]);
    expect((await call("GET", `${LOADS}/LD-NOPE/waybill-history`)).status).toBe(404);
  });
});

/* ── Nhập file ───────────────────────────────────────────────────────── */

async function readBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Dòng tiêu đề lấy từ chính file mẫu của mock, để file thử luôn đúng cột. */
async function templateHeader(): Promise<string> {
  const res = await call("GET", `${IMPORTS}/template`);
  return (await readText(res.data as Blob)).replace(/^\uFEFF/, "").split("\n")[0] ?? "";
}

function upload(content: string, name = "van-don.csv"): FormData {
  const form = new FormData();
  form.append("file", new File([content], name, { type: "text/csv" }));
  return form;
}

/** Dòng 1 là tiêu đề, dữ liệu từ dòng 2 (số dòng Excel). */
async function csv(...rows: string[]): Promise<string> {
  return [await templateHeader(), ...rows].join("\n");
}

const preview = async (content: string) => call("POST", `${IMPORTS}/preview`, upload(content));
const importFile = async (content: string, overwriteLines?: string) =>
  call("POST", IMPORTS, upload(content), overwriteLines ? { overwriteLines } : undefined);

describe("mock file mẫu nhập mã vận đơn", () => {
  it("trả file CSV UTF-8 có BOM với dòng tiêu đề năm cột và không có dòng dữ liệu", async () => {
    const res = await call("GET", `${IMPORTS}/template`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Blob);
    // FileReader.readAsText bỏ BOM khi giải mã, nên kiểm trên byte
    const bytes = new Uint8Array(await readBytes(res.data as Blob));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (await readText(res.data as Blob)).split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.split(",")).toHaveLength(5);
  });
});

describe("mock xem trước nhập file mã vận đơn — từng dòng NEW / OVERWRITE / SAME / ERROR", () => {
  it("mỗi dòng một kết quả kèm lý do, số dòng là số dòng trong file; không ghi gì", async () => {
    // F002 đã có mã cũ → ghi đè; F003 đặt tay chưa có mã → mới
    await putWaybill(BOOKED_VTP, { waybillNo: "VTP-OLD" });
    await book(PLANNED, { carrierId: GHN, vehiclePlate: "51C-1" });
    const content = await csv(
      "LD-2026-F002,VTP-100,51D-1,Tài A,0901", // 2: OVERWRITE
      "LD-2026-F001,GHN-250001", // 3: SAME
      "LD-2026-F001x,GHN-OVR", // 4: LOAD_NOT_FOUND
      "", // 5 (bỏ qua, vẫn tính số dòng)
      "LD-2026-F006,GHN-9", // 6: LOAD_REPEATED (F006 còn ở dòng 13 — BE đánh dấu MỌI dòng lặp, kể cả dòng đầu)
      "LD-2026-F005,GHN-3", // 7: LOAD_NOT_BOOKED
      "LD-2026-F004,GHN-4", // 8: LOAD_CANCELLED
      ",GHN-6", // 9: MISSING_FIELDS
      "LD-2026-F001,A B", // 10: INVALID_WAYBILL
      "LD-2026-F003,GHN-NEW-1", // 11: NEW
      `LD-2026-F002,VTP-200,${"9".repeat(21)}`, // 12: INVALID_VEHICLE_DETAILS (biển số quá 20 ký tự)
      "LD-2026-F006,GHN-10", // 13: LOAD_REPEATED
    );
    const res = await preview(content);
    expect(res.status).toBe(200);
    const parsed = beWaybillImportSchema.parse(res.data);
    expect(parsed.importId).toBeUndefined();
    expect(parsed.fileName).toBe("van-don.csv");
    const byLine = new Map(parsed.lines.map((l) => [l.line, l]));
    expect(parsed.rowsTotal).toBe(11);
    // Xem trước: dòng hợp lệ (mới / không đổi / sẽ ghi đè) = không lỗi, như BE `Verdict.applies()`
    expect(parsed.rowsApplied).toBe(3);
    expect(parsed.lines.map((l) => l.line)).toEqual([2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(byLine.get(2)).toMatchObject({
      outcome: "OVERWRITE",
      loadCode: "LD-2026-F002",
      waybillNo: "VTP-100",
      vehiclePlate: "51D-1",
      driverName: "Tài A",
      driverPhone: "0901",
      loadId: "LD-2026-F002",
    });
    expect(byLine.get(2)?.problem).toBeUndefined();
    expect(byLine.get(3)?.outcome).toBe("SAME");
    expect(byLine.get(11)?.outcome).toBe("NEW");
    const problems: Record<number, string> = {
      4: "LOAD_NOT_FOUND",
      6: "LOAD_REPEATED",
      7: "LOAD_NOT_BOOKED",
      8: "LOAD_CANCELLED",
      9: "MISSING_FIELDS",
      10: "INVALID_WAYBILL",
      12: "INVALID_VEHICLE_DETAILS",
      13: "LOAD_REPEATED",
    };
    for (const [line, problem] of Object.entries(problems)) {
      expect(byLine.get(Number(line)), `dòng ${line}`).toMatchObject({ outcome: "ERROR", problem });
    }
    expect(parsed.rowsRejected).toBe(Object.keys(problems).length);
    // Xem trước không ghi gì
    expect((await readLoad(BOOKED_VTP)).waybillNo).toBe("VTP-OLD");
    expect((await readLoad(PLANNED)).waybillNo).toBeUndefined();
    expect((await readLoad(LOADING_GHN)).waybillNo).toBe("GHN-250001");
    expect(await history(PLANNED)).toEqual([]);
  });

  it("trùng mã: cùng hãng ở chuyến khác nêu chuyến đang giữ; trùng trong file; một chuyến hai dòng; hãng API không nhận mã", async () => {
    // F003 đặt tay hãng VTP với mã VTP-X, F002 cũng hãng VTP
    const carriers = beCarrierPageSchema.parse((await call("GET", CARRIERS)).data);
    const vtp = carriers.items.find((c) => c.connection?.connectionType === "WEBHOOK_LOAD");
    await book(PLANNED, { carrierId: vtp?.carrierId, waybillNo: "VTP-X" });
    const heldBy = beWaybillImportSchema.parse(
      (await preview(await csv("LD-2026-F002,VTP-X"))).data,
    ).lines[0];
    expect(heldBy).toMatchObject({
      outcome: "ERROR",
      problem: "DUPLICATE_IN_CARRIER",
      holderCode: PLANNED,
    });

    // Hai chuyến cùng hãng cùng mã trong file → DUPLICATE_IN_FILE ở CẢ HAI dòng (BE đếm trên cả file)
    await putWaybill(PLANNED, { waybillNo: "VTP-Y" });
    const inFile = beWaybillImportSchema.parse(
      (await preview(await csv("LD-2026-F002,VTP-Z", "LD-2026-F003,VTP-Z"))).data,
    );
    expect(inFile.lines.map((l) => [l.outcome, l.problem])).toEqual([
      ["ERROR", "DUPLICATE_IN_FILE"],
      ["ERROR", "DUPLICATE_IN_FILE"],
    ]);

    const repeated = beWaybillImportSchema.parse(
      (await preview(await csv("LD-2026-F002,VTP-A", "LD-2026-F002,VTP-B"))).data,
    );
    expect(repeated.lines.map((l) => [l.outcome, l.problem])).toEqual([
      ["ERROR", "LOAD_REPEATED"],
      ["ERROR", "LOAD_REPEATED"],
    ]);

    // Xe đã rời kho: một dòng đơn lẻ → LOAD_LEFT (sửa mã trên màn chuyến, quản lý kho, kèm lý do)
    const left = beWaybillImportSchema.parse((await preview(await csv("LD-2026-F006,GHN-9"))).data);
    expect(left.lines[0]).toMatchObject({ outcome: "ERROR", problem: "LOAD_LEFT" });

    const stops = (await readLoad(LOADING_GHN)).shipments.map((s) => s.shipmentId);
    expect(stops.length).toBeGreaterThan(0);
    // Xe đã huỷ đặt xe ở trên được đặt lại qua API: mã vận đơn là của hãng
    await call("POST", `${LOADS}/${PLANNED}/booking-cancellation`, { reason: "đổi" });
    await book(PLANNED, {
      carrierId: API_CARRIER,
      stopShipmentIds: (await readLoad(PLANNED)).shipments.map((s) => s.shipmentId),
    });
    const api = beWaybillImportSchema.parse((await preview(await csv("LD-2026-F003,TAY-1"))).data)
      .lines[0];
    expect(api).toMatchObject({ outcome: "ERROR", problem: "WAYBILL_FROM_CARRIER_API" });
  });
});

describe("mock nhập file mã vận đơn — áp dòng hợp lệ, ghi đè chỉ khi xác nhận (BR-25)", () => {
  const rows = [
    "LD-2026-F002,VTP-100,51D-1,Tài A,0901", // 2: NEW
    "LD-2026-F001,GHN-OVR-1", // 3: OVERWRITE (biển số để trống → giữ)
    "LD-2026-F003,GHN-3", // 4: chưa đặt xe
  ];

  it("không có overwriteLines: dòng NEW áp, dòng ghi đè thành lỗi OVERWRITE_NOT_CONFIRMED, dòng lỗi giữ lý do; trả 201 kèm importId", async () => {
    const res = await importFile(await csv(...rows));
    expect(res.status).toBe(201);
    const result = beWaybillImportSchema.parse(res.data);
    expect(result.importId).toEqual(expect.any(String));
    expect(result).toMatchObject({ rowsTotal: 3, rowsApplied: 1, rowsRejected: 2 });
    expect(result.lines.map((l) => [l.line, l.outcome, l.problem])).toEqual([
      [2, "NEW", undefined],
      [3, "ERROR", "OVERWRITE_NOT_CONFIRMED"],
      [4, "ERROR", "LOAD_NOT_BOOKED"],
    ]);
    const applied = await readLoad(BOOKED_VTP);
    expect(applied).toMatchObject({
      waybillNo: "VTP-100",
      vehiclePlate: "51D-1",
      driverName: "Tài A",
    });
    expect(applied.driverPhone).toBe("0901");
    expect((await readLoad(LOADING_GHN)).waybillNo).toBe("GHN-250001");
    expect(await history(LOADING_GHN)).toHaveLength(1);
  });

  it("overwriteLines=3 áp dòng ghi đè đã tick: mã đổi, cột trống giữ biển số, lịch sử nguồn FILE; dòng đã giống thành SAME", async () => {
    await importFile(await csv(...rows));
    const before = await readLoad(LOADING_GHN);
    const res = await importFile(await csv(...rows), "3");
    const result = beWaybillImportSchema.parse(res.data);
    expect(result).toMatchObject({ rowsApplied: 1, rowsRejected: 1 });
    expect(result.lines.map((l) => [l.line, l.outcome])).toEqual([
      [2, "SAME"],
      [3, "OVERWRITE"],
      [4, "ERROR"],
    ]);
    const after = await readLoad(LOADING_GHN);
    expect(after.waybillNo).toBe("GHN-OVR-1");
    expect(after.vehiclePlate).toBe(before.vehiclePlate);
    expect(after.version).toBe(before.version + 1);
    expect((await history(LOADING_GHN)).at(-1)).toMatchObject({
      oldWaybillNo: "GHN-250001",
      newWaybillNo: "GHN-OVR-1",
      source: "FILE",
    });
  });

  it("overwriteLines chỉ áp đúng số dòng nêu: nêu dòng khác thì dòng ghi đè vẫn bị từ chối; nhiều số cách nhau dấu phẩy; rác bị bỏ qua", async () => {
    const wrong = beWaybillImportSchema.parse((await importFile(await csv(...rows), "2")).data);
    expect(wrong.lines.find((l) => l.line === 3)).toMatchObject({
      outcome: "ERROR",
      problem: "OVERWRITE_NOT_CONFIRMED",
    });
    const ok = beWaybillImportSchema.parse((await importFile(await csv(...rows), "2,abc,3")).data);
    expect(ok.lines.find((l) => l.line === 3)).toMatchObject({ outcome: "OVERWRITE" });
    expect((await readLoad(LOADING_GHN)).waybillNo).toBe("GHN-OVR-1");
  });

  it("file dùng dấu chấm phẩy làm phân cách (Excel VN) vẫn đọc đúng", async () => {
    const header = (await templateHeader()).split(",").join(";");
    const parsed = beWaybillImportSchema.parse(
      (await preview(`${header}\nLD-2026-F002;VTP-SC;51D-9;Tài B;0902`)).data,
    );
    expect(parsed.lines[0]).toMatchObject({
      outcome: "NEW",
      waybillNo: "VTP-SC",
      vehiclePlate: "51D-9",
      driverName: "Tài B",
    });
  });
});

describe("mock file nhập không đọc được → 400 WAYBILL_IMPORT_INVALID_FILE", () => {
  it("không có file, file rỗng, chỉ có tiêu đề, quá 1 MB, quá 1000 dòng — cả xem trước lẫn nhập", async () => {
    const empty = new FormData();
    const tooMany = await csv(...Array.from({ length: 1001 }, (_, i) => `LD-X${i},W-${i}`));
    const cases: [string, FormData][] = [
      ["không file", empty],
      ["rỗng", upload("")],
      ["chỉ tiêu đề", upload(await templateHeader())],
      ["quá 1 MB", upload(`${await templateHeader()}\n${"x".repeat(1024 * 1024)}`)],
      ["quá 1000 dòng", upload(tooMany)],
    ];
    for (const [name, form] of cases) {
      for (const url of [`${IMPORTS}/preview`, IMPORTS]) {
        const res = await call("POST", url, form);
        expect(res.status, `${name} ${url}`).toBe(400);
        expect(errorCode(res), `${name} ${url}`).toBe("WAYBILL_IMPORT_INVALID_FILE");
      }
    }
  });
});

/* ── Danh mục hãng ───────────────────────────────────────────────────── */

const SECRET = "s3cret-0123456789";
const carrierBody = (extra: Record<string, unknown> = {}) => ({
  code: "newcar",
  name: "Hãng mới",
  contactName: "Lan",
  contactPhone: "0903",
  status: "ACTIVE",
  connection: { connectionType: "MANUAL" },
  ...extra,
});

describe("mock danh mục hãng — danh sách, thêm, sửa", () => {
  it("danh sách lọc theo trạng thái và từ khoá (mã hoặc tên, không phân biệt hoa thường); chi tiết đọc theo id", async () => {
    const created = await call("POST", CARRIERS, carrierBody({ status: "INACTIVE" }));
    expect(created.status).toBe(201);
    const list = async (params: Record<string, string>) =>
      beCarrierPageSchema.parse((await call("GET", CARRIERS, undefined, params)).data).items;
    expect((await list({ status: "INACTIVE" })).map((c) => c.code)).toEqual(["NEWCAR"]);
    expect((await list({ status: "ACTIVE" })).every((c) => c.status === "ACTIVE")).toBe(true);
    expect((await list({ search: "ahamove" })).map((c) => c.carrierId)).toEqual([API_CARRIER]);
    expect((await list({ search: "hãng mới" })).map((c) => c.code)).toEqual(["NEWCAR"]);
    const one = beCarrierSchema.parse((await call("GET", `${CARRIERS}/${API_CARRIER}`)).data);
    expect(one.connection?.connectionType).toBe("API_BOOKING");
    expect((await call("GET", `${CARRIERS}/car-nope`)).status).toBe(404);
  });

  it("thêm hãng: mã đổi thành chữ hoa, 201, mặc định MANUAL; khoá bí mật chỉ đi vào, response chỉ có cờ đã lưu", async () => {
    const manual = beCarrierSchema.parse(
      (await call("POST", CARRIERS, carrierBody({ connection: undefined }))).data,
    );
    expect(manual).toMatchObject({
      code: "NEWCAR",
      name: "Hãng mới",
      status: "ACTIVE",
      version: 0,
    });
    expect(manual.connection).toMatchObject({
      connectionType: "MANUAL",
      webhookSecretConfigured: false,
    });

    const res = await call(
      "POST",
      CARRIERS,
      carrierBody({
        code: "WH-1",
        connection: { connectionType: "WEBHOOK_LOAD", webhookSecret: SECRET },
      }),
    );
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.data)).not.toContain(SECRET);
    expect(beCarrierSchema.parse(res.data).connection).toMatchObject({
      connectionType: "WEBHOOK_LOAD",
      webhookSecretConfigured: true,
    });
    // Đọc lại cũng không lộ khoá
    const list = await call("GET", CARRIERS, undefined, { size: "50" });
    expect(JSON.stringify(list.data)).not.toContain(SECRET);
  });

  it("lỗi từng ô: mã sai định dạng, tên trống, webhook thiếu / ngắn / quá dài khoá, kiểu kết nối lạ → 400 VALIDATION_FAILED; trùng mã (kể cả chữ thường) → 409 CARRIER_CODE_EXISTS", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ code: "a" }, "code"],
      [{ code: "bad code!" }, "code"],
      [{ name: "  " }, "name"],
      [{ connection: { connectionType: "WEBHOOK_LOAD" } }, "webhookSecret"],
      [
        { connection: { connectionType: "WEBHOOK_LOAD", webhookSecret: "x".repeat(15) } },
        "webhookSecret",
      ],
      [
        { connection: { connectionType: "WEBHOOK_LOAD", webhookSecret: "x".repeat(513) } },
        "webhookSecret",
      ],
      [{ connection: { connectionType: "SMOKE" } }, "connectionType"],
    ];
    for (const [patch, field] of cases) {
      const res = await call("POST", CARRIERS, carrierBody(patch));
      expect(res.status, field).toBe(400);
      expect(errorCode(res)).toBe("VALIDATION_FAILED");
      expect(errorField(res)).toBe(field);
    }
    const dup = await call("POST", CARRIERS, carrierBody({ code: "ghn" }));
    expect(dup.status).toBe(409);
    expect(errorCode(dup)).toBe("CARRIER_CODE_EXISTS");
    const all = beCarrierPageSchema.parse(
      (await call("GET", CARRIERS, undefined, { size: "50" })).data,
    );
    expect(all.items.filter((c) => c.code === "GHN")).toHaveLength(1);
  });

  it("sửa hãng: version tăng; thiếu `connection` giữ nguyên kiểu kết nối + khoá đã lưu (hãng API đặt xe cũng vậy); version cũ → OPTIMISTIC_LOCK", async () => {
    const carriers = beCarrierPageSchema.parse((await call("GET", CARRIERS)).data).items;
    const webhook = carriers.find((c) => c.connection?.connectionType === "WEBHOOK_LOAD");
    expect(webhook?.connection?.webhookSecretConfigured).toBe(true);
    const renamed = beCarrierSchema.parse(
      (
        await call("PUT", `${CARRIERS}/${webhook?.carrierId}`, {
          code: webhook?.code,
          name: "Viettel Post (đổi tên)",
          status: "INACTIVE",
          version: webhook?.version,
        })
      ).data,
    );
    expect(renamed).toMatchObject({
      name: "Viettel Post (đổi tên)",
      status: "INACTIVE",
      version: (webhook?.version ?? 0) + 1,
    });
    expect(renamed.connection).toMatchObject({
      connectionType: "WEBHOOK_LOAD",
      webhookSecretConfigured: true,
    });

    const api = carriers.find((c) => c.carrierId === API_CARRIER);
    const apiSaved = beCarrierSchema.parse(
      (
        await call("PUT", `${CARRIERS}/${API_CARRIER}`, {
          code: api?.code,
          name: "Ahamove đổi tên",
          status: "ACTIVE",
          version: api?.version,
        })
      ).data,
    );
    expect(apiSaved.connection?.connectionType).toBe("API_BOOKING");

    const stale = await call("PUT", `${CARRIERS}/${API_CARRIER}`, {
      code: api?.code,
      name: "Lần hai",
      status: "ACTIVE",
      version: api?.version,
    });
    expect(stale.status).toBe(409);
    expect(errorCode(stale)).toBe("OPTIMISTIC_LOCK");
    expect(beCarrierSchema.parse((await call("GET", `${CARRIERS}/${API_CARRIER}`)).data).name).toBe(
      "Ahamove đổi tên",
    );
  });

  it("đổi hãng tay sang webhook cần khoá (400 ô webhookSecret), có khoá thì lưu cờ đã đặt; đổi mã trùng hãng khác → 409; hãng không có → 404", async () => {
    const ghn = beCarrierPageSchema
      .parse((await call("GET", CARRIERS)).data)
      .items.find((c) => c.carrierId === GHN);
    const toWebhook = (secret?: string) =>
      call("PUT", `${CARRIERS}/${GHN}`, {
        code: ghn?.code,
        name: ghn?.name,
        status: "ACTIVE",
        version: ghn?.version,
        connection: { connectionType: "WEBHOOK_LOAD", webhookSecret: secret },
      });
    const missing = await toWebhook();
    expect(missing.status).toBe(400);
    expect(errorField(missing)).toBe("webhookSecret");
    expect(
      beCarrierSchema.parse((await call("GET", `${CARRIERS}/${GHN}`)).data).connection
        ?.connectionType,
    ).toBe("MANUAL");
    const saved = beCarrierSchema.parse((await toWebhook(SECRET)).data);
    expect(saved.connection).toMatchObject({
      connectionType: "WEBHOOK_LOAD",
      webhookSecretConfigured: true,
    });
    expect(JSON.stringify(saved)).not.toContain(SECRET);

    const dup = await call("PUT", `${CARRIERS}/${GHN}`, {
      code: "ahamove",
      name: ghn?.name,
      status: "ACTIVE",
      version: saved.version,
    });
    expect(errorCode(dup)).toBe("CARRIER_CODE_EXISTS");
    expect((await call("PUT", `${CARRIERS}/car-nope`, carrierBody())).status).toBe(404);
  });

  it("chỉ fulfillment-carriers:UPDATE được thêm / sửa hãng (403 với nhân viên kho, điều phối, người chỉ xem); đọc danh sách không đòi mã này", async () => {
    for (const grants of [STAFF, [], [CORRECTION]]) {
      actAs(grants);
      expect((await call("POST", CARRIERS, carrierBody())).status).toBe(403);
      expect((await call("PUT", `${CARRIERS}/${GHN}`, carrierBody({ code: "GHN" }))).status).toBe(
        403,
      );
      expect((await call("GET", CARRIERS)).status).toBe(200);
    }
    actAs([CARRIERS_UPDATE]);
    expect((await call("POST", CARRIERS, carrierBody())).status).toBe(201);
  });
});
