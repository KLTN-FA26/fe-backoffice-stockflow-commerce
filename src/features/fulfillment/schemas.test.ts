import { describe, expect, it } from "vitest";

import { FULFILLMENT_FIELD_MESSAGES } from "@/constants";

import {
  DESIGN_LINE_ID,
  apiTask,
  apiTaskLines,
  assignees,
  bePage,
  fulfillmentOrder,
} from "./__fixtures__/task";
import { assignInputSchema, createTaskInputSchema } from "./input-schemas";
import {
  assigneeListSchema,
  beArtifactAccessSchema,
  beFulfillmentTaskPageSchema,
  beFulfillmentTaskSchema,
  fulfillmentOrderSchema,
} from "./schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("fulfillment DTO schemas — hợp đồng BE FulfillmentController", () => {
  it("task mới tạo: BE bỏ hẳn các mốc thời gian chưa có (Jackson non_null)", () => {
    const parsed = beFulfillmentTaskSchema.parse(apiTask());
    expect(parsed.startedAt).toBeUndefined();
    expect(parsed.pickedAt).toBeUndefined();
    expect(parsed.packedAt).toBeUndefined();
    expect(parsed.integrityEvidence).toEqual([]);
  });

  it("task chi tiết parse lines (SCRUM-466)", () => {
    const parsed = beFulfillmentTaskSchema.parse({ ...apiTask(), lines: apiTaskLines });
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines?.find((line) => line.lineId === DESIGN_LINE_ID)?.printLine).toBe(true);
  });

  it("task danh sách không có lines vẫn hợp lệ", () => {
    expect(beFulfillmentTaskSchema.parse(apiTask()).lines).toBeUndefined();
  });

  it("thiếu `integrityEvidence` → mặc định mảng rỗng", () => {
    const { integrityEvidence: _evidence, ...withoutEvidence } = apiTask();
    expect(beFulfillmentTaskSchema.parse(withoutEvidence).integrityEvidence).toEqual([]);
  });

  it("task đích STAGING đã lấy xong (pick STAGED): nhận đích, khu chờ xuất, mốc về khu + chuyển", () => {
    const parsed = beFulfillmentTaskSchema.parse(
      apiTask({
        pickStatus: "STAGED",
        destination: "STAGING",
        stagingLocationCode: "HN-STAGE-01",
        stagedAt: "2026-10-10T02:00:00Z",
      }),
    );
    expect(parsed).toMatchObject({ pickStatus: "STAGED", destination: "STAGING" });
    expect(parsed.movedToDispatchAt).toBeUndefined();
  });

  it("phiên kiểm thùng theo BE PackStatus: IN_PROGRESS / COMPLETED parse được; PACKING / PACKED / ON_HOLD của BE cũ thì không", () => {
    for (const packStatus of ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) {
      expect(beFulfillmentTaskSchema.parse(apiTask({ packStatus })).packStatus).toBe(packStatus);
    }
    for (const packStatus of ["PACKING", "PACKED", "ON_HOLD"]) {
      expect(() => beFulfillmentTaskSchema.parse({ ...apiTask(), packStatus })).toThrow();
    }
  });

  it("pick theo BE PickStatus: có STAGED, không còn SHORT", () => {
    for (const pickStatus of ["PENDING", "PICKING", "STAGED", "PICKED", "CANCELLED"] as const) {
      expect(beFulfillmentTaskSchema.parse(apiTask({ pickStatus })).pickStatus).toBe(pickStatus);
    }
    expect(() => beFulfillmentTaskSchema.parse({ ...apiTask(), pickStatus: "SHORT" })).toThrow();
  });

  it("đích lạ → lỗi hợp đồng; thiếu đích (BE cũ) vẫn parse", () => {
    expect(() =>
      beFulfillmentTaskSchema.parse({ ...apiTask(), destination: "ELSEWHERE" }),
    ).toThrow();
    const { destination: _destination, ...legacy } = apiTask();
    expect(beFulfillmentTaskSchema.parse(legacy).destination).toBeUndefined();
  });

  it("status lạ / thiếu id → parse fail (lỗi hợp đồng, không nuốt)", () => {
    expect(beFulfillmentTaskSchema.safeParse({ ...apiTask(), pickStatus: "DONE" }).success).toBe(
      false,
    );
    const { taskId: _taskId, ...withoutId } = apiTask();
    expect(beFulfillmentTaskSchema.safeParse(withoutId).success).toBe(false);
  });

  it("PageResponse trang từ 0", () => {
    expect(beFulfillmentTaskPageSchema.parse(bePage([apiTask()])).page).toBe(0);
  });

  it("artifact access: vai trò file phải thuộc DesignArtifactRole", () => {
    const artifact = {
      artifactId: "a1",
      role: "PRINT_READY",
      originalName: "front.pdf",
      contentType: "application/pdf",
      sizeBytes: 123456,
      checksum: "c".repeat(64),
      url: "https://files.example/signed",
      expiresAt: "2026-10-10T03:05:00Z",
    };
    expect(beArtifactAccessSchema.parse(artifact).role).toBe("PRINT_READY");
    expect(beArtifactAccessSchema.safeParse({ ...artifact, role: "THUMBNAIL" }).success).toBe(
      false,
    );
  });

  it("artifact access: url chỉ nhận http(s) tuyệt đối — chặn javascript: / data: / đường dẫn tương đối", () => {
    const artifact = {
      artifactId: "a1",
      role: "PRINT_READY",
      originalName: "front.pdf",
      contentType: "application/pdf",
      sizeBytes: 1,
      checksum: "c".repeat(64),
      expiresAt: "2026-10-10T03:05:00Z",
    };
    const ok = (url: string) => beArtifactAccessSchema.safeParse({ ...artifact, url }).success;
    expect(ok("https://files.example/signed?sig=1")).toBe(true);
    expect(ok("http://localhost:9000/bucket/front.pdf")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("JavaScript:alert(1)")).toBe(false);
    expect(ok("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(ok("/files/front.pdf")).toBe(false);
  });

  it("đơn hàng: dòng thường không có snapshot; bỏ qua field không dùng", () => {
    const parsed = fulfillmentOrderSchema.parse({
      ...fulfillmentOrder,
      totalAmount: 1,
      currency: "VND",
    });
    expect(parsed.lines[0]?.designSnapshotId).toBeUndefined();
    expect(parsed.lines[1]?.designSnapshotId).toBeTruthy();
    expect(parsed).not.toHaveProperty("totalAmount");
  });

  it("người nhận task (BE AssigneeResponse): roles mặc định rỗng, displayName có thể thiếu", () => {
    const [first] = assignees;
    const { roles: _roles, ...withoutRoles } = first ?? { userId: "u" };
    expect(assigneeListSchema.parse([withoutRoles])[0]?.roles).toEqual([]);
    expect(assigneeListSchema.parse([{ userId: "u" }])[0]?.displayName).toBeUndefined();
  });
});

describe("fulfillment Input schemas — request BE", () => {
  it("createTask: cần đơn hàng và người được gán (@NotNull)", () => {
    expect(createTaskInputSchema.safeParse({ orderId: "o1", assignedUserId: "u1" }).success).toBe(
      true,
    );
    expect(
      firstMessage(createTaskInputSchema.safeParse({ orderId: "", assignedUserId: "u1" })),
    ).toBe(FULFILLMENT_FIELD_MESSAGES.orderRequired);
    expect(
      firstMessage(createTaskInputSchema.safeParse({ orderId: "o1", assignedUserId: "" })),
    ).toBe(FULFILLMENT_FIELD_MESSAGES.assigneeRequired);
  });

  it("createTask: đích mặc định DISPATCH (docs 07 §3); STAGING kèm khu chờ xuất tuỳ chọn", () => {
    expect(createTaskInputSchema.parse({ orderId: "o1", assignedUserId: "u1" }).destination).toBe(
      "DISPATCH",
    );
    expect(
      createTaskInputSchema.parse({
        orderId: "o1",
        assignedUserId: "u1",
        destination: "STAGING",
        stagingLocationCode: " HN-STAGE-01 ",
      }),
    ).toMatchObject({ destination: "STAGING", stagingLocationCode: "HN-STAGE-01" });
    expect(
      createTaskInputSchema.safeParse({ orderId: "o1", assignedUserId: "u1", destination: "X" })
        .success,
    ).toBe(false);
    expect(
      firstMessage(
        createTaskInputSchema.safeParse({
          orderId: "o1",
          assignedUserId: "u1",
          destination: "STAGING",
          stagingLocationCode: "x".repeat(65),
        }),
      ),
    ).toBe(FULFILLMENT_FIELD_MESSAGES.codeTooLong);
  });

  it("assign: cần người được gán", () => {
    expect(firstMessage(assignInputSchema.safeParse({ assignedUserId: "" }))).toBe(
      FULFILLMENT_FIELD_MESSAGES.assigneeRequired,
    );
  });
});
