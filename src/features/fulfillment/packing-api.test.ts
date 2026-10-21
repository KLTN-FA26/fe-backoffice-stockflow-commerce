import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  PACKAGE_ID,
  SHIPMENT_ID,
  apiLabel,
  apiSession,
  packPackage,
  queueRow,
  sealedPackage,
} from "./__fixtures__/packing";
import { TASK_ID, bePage, pickedTask } from "./__fixtures__/task";
import {
  completePacking,
  getPackageLabel,
  getPackingSession,
  listPackingQueue,
  openPackage,
  removeUnits,
  reopenPackage,
  scanIntoPackage,
  sealPackage,
  startPacking,
  voidPackage,
} from "./packing-api";
import { clearCompletionRequestId, completionRequestId } from "./packing-request-id";

afterEach(() => vi.restoreAllMocks());

const TASK = `/fulfillment/tasks/${TASK_ID}`;
const PKG = `${TASK}/packages/${PACKAGE_ID}`;
const SCAN_ID = "5ca17e5c-0000-4000-8000-000000000001";

describe("packing API — hợp đồng BE PackingController (PR #136)", () => {
  it("hàng chờ: GET /fulfillment/packing-queue với page, size, warehouseId, status; map pack status → tên hiển thị", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage([queueRow(), queueRow({ taskId: "t2", packStatus: "ON_HOLD" })]),
    });
    const page = await listPackingQueue({
      page: 2,
      size: 15,
      warehouseId: "wh-1",
      status: "PACKING",
    });
    expect(get).toHaveBeenCalledWith("/fulfillment/packing-queue", {
      params: { page: 2, size: 15, warehouseId: "wh-1", status: "PACKING" },
      signal: undefined,
    });
    expect(page.items.map((row) => row.packStatus)).toEqual(["Pending", "On Hold"]);
  });

  it("hàng chờ: bỏ trống bộ lọc thì không gửi warehouseId / status; page âm kẹp về 0", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([]) });
    await listPackingQueue({ page: -3, warehouseId: "", status: "" });
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: { page: 0, warehouseId: undefined, status: undefined },
    });
  });

  it("phiên: GET packing-session; giá trị pack status lạ → Unknown", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { ...apiSession(), packStatus: "WEIRD" } });
    const session = await getPackingSession(TASK_ID);
    expect(session.packStatus).toBe("Unknown");
    expect(api.get).toHaveBeenCalledWith(`${TASK}/packing-session`, { signal: undefined });
  });

  it("nhận đơn: POST packing-start không body → phiên", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiSession() });
    expect((await startPacking(TASK_ID)).packStatus).toBe("Packing");
    expect(post).toHaveBeenCalledWith(`${TASK}/packing-start`);
  });

  it("mở kiện: POST packages {packageType} kèm header Idempotency-Key", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: packPackage() });
    const created = await openPackage({
      taskId: TASK_ID,
      packageType: "BAG",
      idempotencyKey: "key-1",
    });
    expect(created.packageNo).toBe(1);
    expect(post).toHaveBeenCalledWith(
      `${TASK}/packages`,
      { packageType: "BAG" },
      { headers: { "Idempotency-Key": "key-1" } },
    );
    await openPackage({ taskId: TASK_ID, idempotencyKey: "key-2" }).catch(() => undefined);
    expect(post.mock.calls[1]?.[1]).toEqual({});
  });

  it("quét: POST scans với scanId, mã, số lượng, lô / serial / dòng — đúng body BE", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiSession() });
    await scanIntoPackage({
      taskId: TASK_ID,
      packageId: PACKAGE_ID,
      scan: {
        scanId: SCAN_ID,
        scannedCode: "TEE",
        quantity: 2,
        lotNumber: "L1",
        orderLineId: "ln-1",
      },
    });
    expect(post).toHaveBeenCalledWith(`${PKG}/scans`, {
      scanId: SCAN_ID,
      scannedCode: "TEE",
      quantity: 2,
      lotNumber: "L1",
      orderLineId: "ln-1",
    });
  });

  it("bớt hàng: DELETE .../lines/{orderLineId} với query quantity, lotNumber, serialNumber, scanId", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValueOnce({ data: apiSession() });
    await removeUnits({
      taskId: TASK_ID,
      packageId: PACKAGE_ID,
      orderLineId: "ln-1",
      quantity: 1,
      lotNumber: "L1",
      scanId: SCAN_ID,
    });
    expect(del).toHaveBeenCalledWith(`${PKG}/lines/ln-1`, {
      params: { quantity: 1, lotNumber: "L1", serialNumber: undefined, scanId: SCAN_ID },
    });
  });

  it("niêm phong: POST seal với số đo + cờ; mở lại: POST reopening; huỷ: DELETE kiện → phiên", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: sealedPackage() })
      .mockResolvedValueOnce({ data: packPackage() });
    const values = {
      weightKg: 1.25,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
      packageType: "CARTON" as const,
      rotatable: false,
      fragile: undefined,
    };
    expect((await sealPackage({ taskId: TASK_ID, packageId: PACKAGE_ID, values })).status).toBe(
      "SEALED",
    );
    expect(post).toHaveBeenCalledWith(`${PKG}/seal`, values);
    expect((await reopenPackage({ taskId: TASK_ID, packageId: PACKAGE_ID })).status).toBe("OPEN");
    expect(post).toHaveBeenLastCalledWith(`${PKG}/reopening`);

    const del = vi.spyOn(api, "delete").mockResolvedValueOnce({ data: apiSession() });
    await voidPackage({ taskId: TASK_ID, packageId: PACKAGE_ID });
    expect(del).toHaveBeenCalledWith(PKG);
  });

  it("nhãn: GET label (no-store) → dữ liệu in", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: apiLabel() });
    const label = await getPackageLabel({ taskId: TASK_ID, packageId: PACKAGE_ID });
    expect(get).toHaveBeenCalledWith(`${PKG}/label`, { signal: undefined });
    expect(label).toMatchObject({ provisional: true, packageNo: 1, packageCount: 2 });
  });

  it("hoàn tất: POST packing-completion {requestId, partial, note}; đủ đơn thì không gửi note", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({
        data: { ...pickedTask({ packStatus: "PACKED" }), shipmentId: SHIPMENT_ID },
      })
      .mockResolvedValueOnce({ data: pickedTask({ packStatus: "PACKING" }) });
    const full = await completePacking({
      taskId: TASK_ID,
      requestId: "req-1",
      partial: false,
      note: "bỏ qua",
    });
    expect(full).toMatchObject({ packStatus: "Packed", shipmentId: SHIPMENT_ID });
    expect(post).toHaveBeenCalledWith(`${TASK}/packing-completion`, {
      requestId: "req-1",
      partial: false,
      note: undefined,
    });
    await completePacking({
      taskId: TASK_ID,
      requestId: "req-2",
      partial: true,
      note: "thiếu hàng",
    });
    expect(post).toHaveBeenLastCalledWith(`${TASK}/packing-completion`, {
      requestId: "req-2",
      partial: true,
      note: "thiếu hàng",
    });
  });

  it("hoàn tất lệch thiết kế: 200 + On Hold, KHÔNG có shipmentId — người gọi đọc packStatus", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: pickedTask({ packStatus: "ON_HOLD" }) });
    const held = await completePacking({ taskId: TASK_ID, requestId: "r", partial: false });
    expect(held.packStatus).toBe("On Hold");
    expect(held.shipmentId).toBeUndefined();
  });
});

describe("requestId của lần hoàn tất — nhớ theo task trong sessionStorage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("cùng task → cùng id cho tới khi lần hoàn tất tạo lô giao; task khác → id khác", () => {
    const first = completionRequestId("task-a");
    expect(completionRequestId("task-a")).toBe(first);
    expect(completionRequestId("task-b")).not.toBe(first);
    expect(window.sessionStorage.getItem(`stockflow:admin:packing:completion:task-a`)).toBe(first);
    clearCompletionRequestId("task-a");
    expect(window.sessionStorage.getItem(`stockflow:admin:packing:completion:task-a`)).toBeNull();
    expect(completionRequestId("task-a")).not.toBe(first);
  });

  it("sessionStorage bị chặn → vẫn giữ id trong bộ nhớ, không ném lỗi", () => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const id = completionRequestId("task-blocked");
    expect(completionRequestId("task-blocked")).toBe(id);
    expect(() => clearCompletionRequestId("task-blocked")).not.toThrow();
    expect(original).toBeDefined();
  });
});
