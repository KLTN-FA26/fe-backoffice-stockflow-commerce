import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  DESIGN_LINE_ID,
  ORDER_ID,
  OTHER_PICKER_ID,
  PICKER_ID,
  TASK_ID,
  apiTask,
  assignableUsers,
  bePage,
  fulfillmentOrder,
  mismatchEvidence,
  pickedTask,
} from "./__fixtures__/task";
import {
  assignFulfillmentTask,
  completePacking,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  getFulfillmentTask,
  listFulfillmentTasks,
  reverifyDesignIntegrity,
  startPicking,
} from "./api";
import {
  getFulfillmentOrder,
  listAssignableUsers,
  listFulfillableOrders,
  listOrderNumbers,
} from "./reference-api";

afterEach(() => vi.restoreAllMocks());

const PATH = `/fulfillment/tasks/${TASK_ID}`;

describe("fulfillment task API — hợp đồng BE FulfillmentController", () => {
  it("list chỉ gửi page (0-based) + size, không v1, không filter; map status sang nhãn docs", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage([apiTask(), pickedTask({ packStatus: "ON_HOLD" })]),
    });

    const result = await listFulfillmentTasks({ page: 2, size: 20 });

    expect(get).toHaveBeenCalledWith(
      "/fulfillment/tasks",
      expect.objectContaining({ params: { page: 2, size: 20 } }),
    );
    expect(result.items.map((task) => [task.pickStatus, task.packStatus])).toEqual([
      ["Assigned", "Pending"],
      ["Picked", "On Hold"],
    ]);
  });

  it("list: trang âm bị kẹp về 0 (BE trả 400 nếu page < 0)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([]) });
    await listFulfillmentTasks({ page: -3 });
    expect(get.mock.calls[0]?.[1]).toMatchObject({ params: { page: 0, size: 15 } });
  });

  it("detail đọc theo taskId và map status", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ data: apiTask({ pickStatus: "PICKING" }) });
    const task = await getFulfillmentTask(TASK_ID);
    expect(get.mock.calls[0]?.[0]).toBe(PATH);
    expect(task.pickStatus).toBe("In Progress");
  });

  it("tạo task gửi đúng `CreateTaskRequest`", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiTask() });
    await createFulfillmentTask({ orderId: ORDER_ID, assignedUserId: PICKER_ID });
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
    });
  });

  it("gán lại là PUT …/assignment với `AssignmentRequest`", async () => {
    const put = vi
      .spyOn(api, "put")
      .mockResolvedValueOnce({ data: apiTask({ assignedUserId: OTHER_PICKER_ID }) });
    const task = await assignFulfillmentTask({ taskId: TASK_ID, assignedUserId: OTHER_PICKER_ID });
    expect(put).toHaveBeenCalledWith(`${PATH}/assignment`, { assignedUserId: OTHER_PICKER_ID });
    expect(task.assignedUserId).toBe(OTHER_PICKER_ID);
  });

  it("bắt đầu / hoàn tất lấy hàng và đóng gói là POST KHÔNG body", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: apiTask({ pickStatus: "PICKING" }) })
      .mockResolvedValueOnce({ data: pickedTask() })
      .mockResolvedValueOnce({ data: pickedTask({ packStatus: "PACKED" }) });

    expect((await startPicking(TASK_ID)).pickStatus).toBe("In Progress");
    expect((await completePicking(TASK_ID)).pickStatus).toBe("Picked");
    expect((await completePacking(TASK_ID)).packStatus).toBe("Packed");
    expect(post.mock.calls).toEqual([
      [`${PATH}/picking-start`, undefined],
      [`${PATH}/picking-completion`, undefined],
      [`${PATH}/packing-completion`, undefined],
    ]);
  });

  it("X-CHK: đóng gói lệch checksum trả 200 → kết quả `On Hold` kèm evidence, không ném lỗi", async () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({
      data: pickedTask({ packStatus: "ON_HOLD", integrityEvidence: [mismatchEvidence()] }),
    });
    const task = await completePacking(TASK_ID);
    expect(task.packStatus).toBe("On Hold");
    expect(task.packedAt).toBeUndefined();
    expect(task.integrityEvidence[0]?.matching).toBe(false);
  });

  it("kiểm tra lại gửi `resolutionNote`", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: pickedTask({ packStatus: "PACKED" }) });
    await reverifyDesignIntegrity({ taskId: TASK_ID, resolutionNote: "đã khôi phục file" });
    expect(post).toHaveBeenCalledWith(`${PATH}/design-integrity-reverification`, {
      resolutionNote: "đã khôi phục file",
    });
  });

  it("artifact: lineId là id dòng đơn hàng, role nằm trong path", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        artifactId: "a1",
        role: "PRINT_READY",
        originalName: "front.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        checksum: "c".repeat(64),
        url: "https://files.example/signed",
        expiresAt: "2026-10-10T03:05:00Z",
      },
    });
    const artifact = await getDesignArtifactUrl({
      taskId: TASK_ID,
      lineId: DESIGN_LINE_ID,
      role: "PRINT_READY",
    });
    expect(get.mock.calls[0]?.[0]).toBe(
      `${PATH}/lines/${DESIGN_LINE_ID}/design-artifacts/PRINT_READY/download-url`,
    );
    expect(artifact.url).toBe("https://files.example/signed");
  });

  it("response sai hợp đồng → ném ZodError (không trả dữ liệu chưa validate)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { taskId: TASK_ID } });
    await expect(getFulfillmentTask(TASK_ID)).rejects.toThrow();
  });
});

describe("dữ liệu phụ trợ — đơn hàng và nhân viên", () => {
  it("đơn của task đọc qua GET /orders/{id}", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: fulfillmentOrder });
    const order = await getFulfillmentOrder(ORDER_ID);
    expect(get.mock.calls[0]?.[0]).toBe(`/orders/${ORDER_ID}`);
    expect(order.lines).toHaveLength(2);
  });

  it("đơn chờ xuất kho lọc đúng CONFIRMED + READY_TO_FULFILL (key lặp cho Spring)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([fulfillmentOrder]) });
    await listFulfillableOrders();
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: { page: 0, status: ["CONFIRMED", "READY_TO_FULFILL"] },
      paramsSerializer: { indexes: null },
    });
  });

  it("listOrderNumbers trả bản đồ id → số đơn", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([fulfillmentOrder]) });
    expect(await listOrderNumbers()).toEqual({ [ORDER_ID]: "SO-20261010-000431" });
  });

  it("nhân viên gán được: gọi riêng từng vai trò (BE nhận một role), ACTIVE, gộp bỏ trùng", async () => {
    const [staff, other] = assignableUsers;
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ data: bePage([staff, other]) })
      .mockResolvedValueOnce({ data: bePage([staff]) });

    const users = await listAssignableUsers();

    expect(get.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({ role: "WAREHOUSE_STAFF", status: "ACTIVE" }),
      }),
      expect.objectContaining({
        params: expect.objectContaining({ role: "WAREHOUSE_MANAGER", status: "ACTIVE" }),
      }),
    ]);
    expect(users.map((user) => user.userId).sort()).toEqual([PICKER_ID, OTHER_PICKER_ID].sort());
  });
});
