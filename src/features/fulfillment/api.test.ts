import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  DESIGN_LINE_ID,
  ORDER_ID,
  OTHER_PICKER_ID,
  PICKER_ID,
  TASK_ID,
  WAREHOUSE_ID,
  apiTask,
  assignees,
  bePage,
  fulfillmentOrder,
  pickedTask,
  stagedTask,
  taskCandidate,
} from "./__fixtures__/task";
import {
  assignFulfillmentTask,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  getFulfillmentTask,
  listFulfillmentTasks,
  moveToDispatch,
  startPicking,
} from "./api";
import { getFulfillmentOrder, listAssignees, listTaskCandidates } from "./reference-api";

afterEach(() => vi.restoreAllMocks());

const PATH = `/fulfillment/tasks/${TASK_ID}`;

describe("fulfillment task API — hợp đồng BE FulfillmentController", () => {
  it("list chỉ gửi page (0-based) + size, không v1, không filter; map status sang nhãn docs", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: bePage([apiTask(), pickedTask({ packStatus: "IN_PROGRESS" }), stagedTask()]),
    });

    const result = await listFulfillmentTasks({ page: 2, size: 20 });

    expect(get).toHaveBeenCalledWith(
      "/fulfillment/tasks",
      expect.objectContaining({ params: { page: 2, size: 20 } }),
    );
    expect(result.items.map((task) => [task.pickStatus, task.packStatus])).toEqual([
      ["Pending", "Pending"],
      ["Picked", "In Progress"],
      ["Staged", "Pending"],
    ]);
    // Task đích STAGING mang đích + khu chờ xuất (docs 07 §1)
    expect(result.items[2]).toMatchObject({
      destination: "STAGING",
      stagingLocationCode: "HN-STAGE-01",
    });
  });

  it("list gửi status/warehouseId/assignedUserId khi có, bỏ khi trống (SCRUM-466)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: bePage([apiTask()]) });
    await listFulfillmentTasks({
      page: 0,
      size: 15,
      status: "PICKING",
      warehouseId: WAREHOUSE_ID,
      assignedUserId: PICKER_ID,
    });
    expect(get.mock.calls[0]?.[1]).toMatchObject({
      params: {
        page: 0,
        size: 15,
        status: "PICKING",
        warehouseId: WAREHOUSE_ID,
        assignedUserId: PICKER_ID,
      },
    });
    await listFulfillmentTasks({ page: 0, size: 15, status: undefined, warehouseId: "" });
    expect(get.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ params: { page: 0, size: 15 } }),
    );
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
    expect(task.pickStatus).toBe("Picking");
  });

  it("tạo task gửi đúng `CreateTaskRequest` — đích DISPATCH, không kèm khu chờ xuất", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: apiTask() });
    await createFulfillmentTask({
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "DISPATCH",
      // Form còn mang lựa chọn cũ: đích DISPATCH thì không gửi khu chờ xuất (BE bỏ qua)
      stagingLocationCode: "HN-STAGE-01",
    });
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "DISPATCH",
    });
  });

  it("tạo task đích STAGING gửi kèm khu chờ xuất của kho (bỏ được khi kho chỉ có một khu)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: stagedTask() });
    await createFulfillmentTask({
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "STAGING",
      stagingLocationCode: "HN-STAGE-01",
    });
    expect(post).toHaveBeenLastCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "STAGING",
      stagingLocationCode: "HN-STAGE-01",
    });
    await createFulfillmentTask({
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "STAGING",
    });
    expect(post).toHaveBeenLastCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: PICKER_ID,
      destination: "STAGING",
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

  it("bắt đầu / hoàn tất lấy hàng là POST KHÔNG body", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValueOnce({ data: apiTask({ pickStatus: "PICKING" }) })
      .mockResolvedValueOnce({ data: pickedTask() });

    expect((await startPicking(TASK_ID)).pickStatus).toBe("Picking");
    expect((await completePicking(TASK_ID)).pickStatus).toBe("Picked");
    expect(post.mock.calls).toEqual([
      [`${PATH}/picking-start`, undefined],
      [`${PATH}/picking-completion`, undefined],
    ]);
  });

  it("chuyển cả task sang khu xuất hàng: POST …/dispatch-transfer KHÔNG body, task Staged → Picked (docs 07 §4.3 bước 8)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: pickedTask({
        destination: "STAGING",
        stagingLocationCode: "HN-STAGE-01",
        movedToDispatchAt: "2026-10-11T02:00:00Z",
      }),
    });
    const task = await moveToDispatch(TASK_ID);
    expect(post).toHaveBeenCalledWith(`${PATH}/dispatch-transfer`, undefined);
    expect(task).toMatchObject({ pickStatus: "Picked", movedToDispatchAt: "2026-10-11T02:00:00Z" });
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

  it("đơn chờ xuất kho: GET /fulfillment/task-candidates (không gọi /orders), parse trang + dòng in", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([taskCandidate]) });
    const page = await listTaskCandidates();
    expect(get.mock.calls[0]?.[0]).toBe("/fulfillment/task-candidates");
    expect(get.mock.calls[0]?.[1]).toMatchObject({ params: { page: 0, size: 200 } });
    expect(page.items[0]).toMatchObject({ lineCount: 2, totalQuantity: 5 });
    expect(page.items[0]?.lines.map((line) => line.printed)).toEqual([false, true]);
  });

  it("đơn chờ xuất kho: truyền warehouseId khi có; khách vãng lai không có customerId / customerName", async () => {
    const guest = { ...taskCandidate, customerId: undefined, customerName: undefined };
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([guest]) });
    const page = await listTaskCandidates({ warehouseId: WAREHOUSE_ID });
    expect(get.mock.calls[0]?.[1]).toMatchObject({ params: { warehouseId: WAREHOUSE_ID } });
    expect(page.items[0]?.customerName).toBeUndefined();
  });

  it("đơn chờ xuất kho: response sai hợp đồng (thiếu lineCount) → từ chối", async () => {
    const { lineCount: _omit, ...broken } = taskCandidate;
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: bePage([broken]) });
    await expect(listTaskCandidates()).rejects.toThrow();
  });

  it("người nhận task: GET /fulfillment/assignees?warehouseId=, xếp theo tên, không gọi /identity/users", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: [assignees[1], assignees[0]] });

    const users = await listAssignees(WAREHOUSE_ID);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe("/fulfillment/assignees");
    expect(get.mock.calls[0]?.[1]).toMatchObject({ params: { warehouseId: WAREHOUSE_ID } });
    expect(users.map((user) => user.userId)).toEqual([PICKER_ID, OTHER_PICKER_ID]);
  });
});
