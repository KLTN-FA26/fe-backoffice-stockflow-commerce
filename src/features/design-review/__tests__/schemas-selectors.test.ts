import { describe, expect, it } from "vitest";

import { allowedReviewActions } from "../lifecycle";
import { designArtifactListSchema, designDecisionInputSchema, designDtoSchema } from "../schemas";
import { currentSubmission, isDecidable, labelOf, waitingSince } from "../selectors";
import { ARTIFACTS, PENDING_DESIGN } from "./fixtures";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const canApprove = (code: PermissionCode) => code === "design-designs:APPROVE";
const cannot = () => false;

describe("designDecisionInputSchema (12 BR-06; DesignReviewService.java:170-182)", () => {
  it.each([
    ["thiếu lý do", ""],
    ["lý do toàn khoảng trắng", "   \n "],
    ["2001 ký tự", "a".repeat(2001)],
  ])("trả lại %s → lỗi", (_, notes) => {
    expect(designDecisionInputSchema.safeParse({ approved: false, notes }).success).toBe(false);
  });

  it("trả lại: lý do được bỏ khoảng trắng hai đầu, 2000 ký tự vẫn hợp lệ", () => {
    expect(designDecisionInputSchema.parse({ approved: false, notes: "  Sửa logo  " })).toEqual({
      approved: false,
      notes: "Sửa logo",
    });
    expect(
      designDecisionInputSchema.safeParse({ approved: false, notes: "a".repeat(2000) }).success,
    ).toBe(true);
  });

  it("duyệt: ghi chú tuỳ chọn, rỗng thì bỏ, quá 2000 → lỗi", () => {
    expect(designDecisionInputSchema.parse({ approved: true, notes: "  " })).toEqual({
      approved: true,
      notes: undefined,
    });
    expect(designDecisionInputSchema.parse({ approved: true })).toEqual({
      approved: true,
      notes: undefined,
    });
    expect(
      designDecisionInputSchema.safeParse({ approved: true, notes: "a".repeat(2001) }).success,
    ).toBe(false);
  });
});

describe("DTO", () => {
  it("DTO thiếu trường nullable vẫn parse", () => {
    const parsed = designDtoSchema.parse({
      id: "d1",
      productId: "p1",
      name: "Túi",
      status: "PENDING_REVIEW",
      version: 0,
    });
    expect(parsed.customerId).toBeNull();
    expect(parsed.previewUrl).toBeNull();
    expect(parsed.reviewRequestedAt).toBeNull();
  });
  it("artifact list theo hợp đồng BE", () => {
    expect(designArtifactListSchema.parse(ARTIFACTS)).toHaveLength(5);
  });
});

describe("selectors", () => {
  it("currentSubmission lấy bản mới nhất mỗi role", () => {
    const artifacts = designArtifactListSchema.parse([...ARTIFACTS].reverse());
    const { current, previous } = currentSubmission(artifacts);
    expect(current.map((a) => a.artifactId)).toEqual([
      "0a000000-0000-7000-8000-000000000003",
      "0a000000-0000-7000-8000-000000000004",
      "0a000000-0000-7000-8000-000000000005",
    ]);
    expect(previous.map((a) => a.artifactId)).toEqual([
      "0a000000-0000-7000-8000-000000000001",
      "0a000000-0000-7000-8000-000000000002",
    ]);
  });

  it("currentSubmission bỏ phiếu sản xuất khỏi bộ khách gửi", () => {
    const artifacts = designArtifactListSchema.parse([
      {
        ...ARTIFACTS[1],
        artifactId: "x",
        role: "PRODUCTION_INSTRUCTION",
        storedAt: "2026-12-01T00:00:00Z",
      },
      ...ARTIFACTS,
    ]);
    expect(currentSubmission(artifacts).current.map((a) => a.role)).toEqual([
      "CUSTOMER_PREVIEW",
      "PRINT_READY",
      "TECHNICAL_SPEC",
    ]);
  });

  it("isDecidable chỉ PENDING_REVIEW + APPROVE", () => {
    expect(isDecidable({ status: "PENDING_REVIEW" }, canApprove)).toBe(true);
    expect(isDecidable({ status: "PENDING_REVIEW" }, cannot)).toBe(false);
    for (const status of ["DRAFT", "APPROVED", "ARCHIVED"] as const)
      expect(isDecidable({ status }, canApprove)).toBe(false);
  });

  it("allowedReviewActions: Duyệt + Trả lại khi quyết được, còn lại rỗng", () => {
    expect(
      allowedReviewActions({ status: "PENDING_REVIEW" }, canApprove).map((a) => a.code),
    ).toEqual(["approve", "return"]);
    expect(allowedReviewActions({ status: "APPROVED" }, canApprove)).toEqual([]);
    expect(allowedReviewActions({ status: "PENDING_REVIEW" }, cannot)).toEqual([]);
  });

  it("waitingSince theo ngày / giờ / phút", () => {
    const now = new Date("2026-11-20T03:30:00Z");
    expect(waitingSince(PENDING_DESIGN, now)).toBe("chờ 2 ngày");
    expect(waitingSince({ reviewRequestedAt: "2026-11-20T00:00:00Z" }, now)).toBe("chờ 3 giờ");
    expect(waitingSince({ reviewRequestedAt: "2026-11-20T03:25:00Z" }, now)).toBe("chờ 5 phút");
    expect(waitingSince({ reviewRequestedAt: null }, now)).toBeNull();
  });

  it("labelOf: mã lạ của lịch sử cũ hiện nguyên văn", () => {
    expect(labelOf({ APPROVED: "Duyệt" }, "APPROVED")).toBe("Duyệt");
    expect(labelOf({ APPROVED: "Duyệt" }, "SENT_TO_CUSTOMER")).toBe("SENT_TO_CUSTOMER");
  });
});
