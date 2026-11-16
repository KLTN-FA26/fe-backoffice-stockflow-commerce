import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  QUEUE_PATH,
  allLabeledSession,
  checkedCarton,
  queueRow,
  startedSession,
} from "./__fixtures__/carton-check";
import { apiTask, bePage } from "./__fixtures__/task";
import {
  checkCarton,
  completeCartonCheck,
  displaySessionStatus,
  getCartonCheckSession,
  labelCartons,
  listCartonCheckQueue,
  printShippingLabels,
  removeCarton,
  reprintCartonLabel,
  startCartonCheck,
} from "./carton-check-api";

afterEach(() => vi.restoreAllMocks());

describe("hàng chờ kiểm thùng — GET /fulfillment/packing-queue", () => {
  it("gửi page (0-based) + size; không gửi status / warehouseId khi trống; đổi status sang nhãn docs", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage([queueRow(), queueRow({ status: "IN_PROGRESS", startedBy: "u1" })]),
    });
    const page = await listCartonCheckQueue({});
    expect(get.mock.calls[0]?.[0]).toBe(QUEUE_PATH);
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: { page: 0, size: PAGE_SIZE.md, status: undefined, warehouseId: undefined },
    });
    expect(page.items.map((row) => row.status)).toEqual(["Pending", "In Progress"]);
  });

  it("truyền kho + trạng thái đã lọc", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([]) });
    await listCartonCheckQueue({ page: 2, size: 50, warehouseId: "wh-1", status: "IN_PROGRESS" });
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: { page: 2, size: 50, warehouseId: "wh-1", status: "IN_PROGRESS" },
    });
  });

  it("response theo hợp đồng cũ (packStatus / packageCount) → từ chối, không trả dữ liệu chưa validate", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage([{ taskId: "t", orderId: "o", packStatus: "PACKING", packageCount: 1 }]),
    });
    await expect(listCartonCheckQueue({})).rejects.toThrow();
  });
});

describe("phiên kiểm thùng", () => {
  it("GET packing-session: đổi trạng thái phiên và thùng sang tên nguyên văn docs", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: startedSession({ cartons: [checkedCarton()] }),
    });
    const session = await getCartonCheckSession("t-1");
    expect(get.mock.calls[0]?.[0]).toBe("/fulfillment/tasks/t-1/packing-session");
    expect(session.status).toBe("In Progress");
    expect(session.cartons[0]?.status).toBe("Checked");
  });

  it("trạng thái phiên lạ → Unknown", () => {
    expect(displaySessionStatus("PACKING")).toBe("Unknown");
    expect(displaySessionStatus("COMPLETED")).toBe("Completed");
  });

  it("POST packing-start không body", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: startedSession() });
    const session = await startCartonCheck("t-1");
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks/t-1/packing-start");
    expect(session.status).toBe("In Progress");
  });

  it("POST carton-checks {lpn}", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: startedSession() });
    await checkCarton({ taskId: "t-1", lpn: "LPN000001" });
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks/t-1/carton-checks", { lpn: "LPN000001" });
  });
});

describe("dán nhãn, in lại, loại thùng", () => {
  it("POST carton-labels: gửi lpns được chọn; không chọn thì không body (BE dán mọi thùng Checked)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: allLabeledSession() });
    await labelCartons({ taskId: "t-1", lpns: ["LPN000001", "LPN000002"] });
    await labelCartons({ taskId: "t-1" });
    await labelCartons({ taskId: "t-1", lpns: [] });
    expect(post.mock.calls[0]).toEqual([
      "/fulfillment/tasks/t-1/carton-labels",
      { lpns: ["LPN000001", "LPN000002"] },
    ]);
    expect(post.mock.calls[1]).toEqual(["/fulfillment/tasks/t-1/carton-labels", undefined]);
    expect(post.mock.calls[2]).toEqual(["/fulfillment/tasks/t-1/carton-labels", undefined]);
  });

  it("POST label-reprint: LPN trong path (mã hoá), fromVersion là query param", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: allLabeledSession() });
    await reprintCartonLabel({ taskId: "t-1", lpn: "LPN/01", fromVersion: 2 });
    expect(post).toHaveBeenCalledWith(
      "/fulfillment/tasks/t-1/cartons/LPN%2F01/label-reprint",
      undefined,
      { params: { fromVersion: 2 } },
    );
  });

  it("POST removal: có ghi chú thì gửi {note}, không thì không body", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: startedSession() });
    await removeCarton({ taskId: "t-1", lpn: "LPN000001", note: "móp góc" });
    await removeCarton({ taskId: "t-1", lpn: "LPN000001" });
    expect(post.mock.calls[0]).toEqual([
      "/fulfillment/tasks/t-1/cartons/LPN000001/removal",
      { note: "móp góc" },
    ]);
    expect(post.mock.calls[1]).toEqual([
      "/fulfillment/tasks/t-1/cartons/LPN000001/removal",
      undefined,
    ]);
  });
});

describe("PDF nhãn giao hàng — POST shipping-labels", () => {
  it("yêu cầu Blob + Accept pdf/json; lấy tên file từ content-disposition", async () => {
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="shipping-labels-SO-1.pdf"' },
    });
    const result = await printShippingLabels({ taskId: "t-1", lpns: ["LPN000001"] });
    expect(post).toHaveBeenCalledWith(
      "/fulfillment/tasks/t-1/shipping-labels",
      { lpns: ["LPN000001"] },
      { responseType: "blob", headers: { Accept: "application/pdf, application/json" } },
    );
    expect(result).toEqual({ blob: pdf, fileName: "shipping-labels-SO-1.pdf" });
  });

  it("thiếu content-disposition → tên mặc định; không chọn thùng → không body", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: new Blob(["x"]), headers: {} });
    const result = await printShippingLabels({ taskId: "t-1" });
    expect(post.mock.calls[0]?.[1]).toBeUndefined();
    expect(result.fileName).toBe("shipping-labels.pdf");
  });
});

describe("hoàn tất — POST packing-completion", () => {
  it("đủ thùng: gửi requestId, partial = false, không ghi chú; đổi trạng thái task sang nhãn docs", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: apiTask({ pickStatus: "PICKED", packStatus: "COMPLETED", shipmentId: "s-1" }),
    });
    const task = await completeCartonCheck({ taskId: "t-1", requestId: "r-1", partial: false });
    expect(post).toHaveBeenCalledWith(`/fulfillment/tasks/t-1/packing-completion`, {
      requestId: "r-1",
      partial: false,
      note: undefined,
    });
    expect(task).toMatchObject({ packStatus: "Completed", shipmentId: "s-1" });
  });

  it("giao một phần: gửi note; phiên ở lại In Progress", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: apiTask({ pickStatus: "PICKED", packStatus: "IN_PROGRESS", shipmentId: "s-2" }),
    });
    const task = await completeCartonCheck({
      taskId: "t-1",
      requestId: "r-2",
      partial: true,
      note: "Thùng hỏng đã loại",
    });
    expect(post.mock.calls[0]?.[1]).toMatchObject({ partial: true, note: "Thùng hỏng đã loại" });
    expect(task.packStatus).toBe("In Progress");
  });

  it("note chỉ gửi khi giao một phần", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: apiTask({ packStatus: "COMPLETED" }),
    });
    await completeCartonCheck({ taskId: "t-1", requestId: "r-1", partial: false, note: "bỏ qua" });
    expect(post.mock.calls[0]?.[1]).toMatchObject({ note: undefined });
  });

  it("còn đợt BEFORE_DELIVERY chưa thu: câu trả lời 200 kèm paymentDue (cảnh báo, không chặn)", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: apiTask({
        packStatus: "COMPLETED",
        shipmentId: "s-1",
        paymentDue: { amountDueBeforeHandover: 2500000, currency: "VND" },
      }),
    });
    const task = await completeCartonCheck({ taskId: "t-1", requestId: "r-1", partial: false });
    expect(task.paymentDue).toEqual({ amountDueBeforeHandover: 2500000, currency: "VND" });
  });
});
