import { describe, expect, it } from "vitest";

import { FULFILLMENT_FIELD_MESSAGES, FULFILLMENT_LIMITS } from "@/constants";

import {
  apiTask,
  assignableUsers,
  bePage,
  fulfillmentOrder,
  mismatchEvidence,
} from "./__fixtures__/task";
import { assignInputSchema, createTaskInputSchema, reverifyInputSchema } from "./input-schemas";
import {
  assignableUserPageSchema,
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

  it("thiếu `integrityEvidence` → mặc định mảng rỗng", () => {
    const { integrityEvidence: _evidence, ...withoutEvidence } = apiTask();
    expect(beFulfillmentTaskSchema.parse(withoutEvidence).integrityEvidence).toEqual([]);
  });

  it("task bị giữ: nhận evidence lệch checksum", () => {
    const parsed = beFulfillmentTaskSchema.parse(
      apiTask({
        pickStatus: "PICKED",
        packStatus: "ON_HOLD",
        integrityEvidence: [mismatchEvidence()],
      }),
    );
    expect(parsed.integrityEvidence[0]?.matching).toBe(false);
  });

  it("nhận đủ mọi giá trị enum BE, kể cả SHORT / PACKING / CANCELLED", () => {
    for (const pickStatus of ["PENDING", "PICKING", "PICKED", "SHORT", "CANCELLED"] as const) {
      expect(beFulfillmentTaskSchema.safeParse(apiTask({ pickStatus })).success).toBe(true);
    }
    for (const packStatus of ["PENDING", "PACKING", "ON_HOLD", "PACKED", "CANCELLED"] as const) {
      expect(beFulfillmentTaskSchema.safeParse(apiTask({ packStatus })).success).toBe(true);
    }
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

  it("danh sách nhân viên: roles mặc định rỗng", () => {
    const [first] = assignableUsers;
    const { roles: _roles, ...withoutRoles } = first ?? { userId: "u" };
    expect(assignableUserPageSchema.parse(bePage([withoutRoles])).items[0]?.roles).toEqual([]);
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

  it("assign: cần người được gán", () => {
    expect(firstMessage(assignInputSchema.safeParse({ assignedUserId: "" }))).toBe(
      FULFILLMENT_FIELD_MESSAGES.assigneeRequired,
    );
  });

  it("reverify: ghi chú xử lý bắt buộc (@NotBlank), cắt khoảng trắng", () => {
    expect(firstMessage(reverifyInputSchema.safeParse({ resolutionNote: "   " }))).toBe(
      FULFILLMENT_FIELD_MESSAGES.resolutionNoteRequired,
    );
    expect(
      reverifyInputSchema.parse({ resolutionNote: "  đã khôi phục file  " }).resolutionNote,
    ).toBe("đã khôi phục file");
  });

  it("reverify: tối đa 1000 ký tự (@Size(max = 1000)) — đúng biên", () => {
    const max = FULFILLMENT_LIMITS.resolutionNoteMax;
    expect(reverifyInputSchema.safeParse({ resolutionNote: "x".repeat(max) }).success).toBe(true);
    expect(
      firstMessage(reverifyInputSchema.safeParse({ resolutionNote: "x".repeat(max + 1) })),
    ).toBe(FULFILLMENT_FIELD_MESSAGES.resolutionNoteTooLong);
  });
});
