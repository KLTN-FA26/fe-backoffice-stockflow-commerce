/**
 * Duyệt thiết kế của khách — BE origin/develop 5fe7b9a16 (`design/internal/controller/dto/*`). Jackson `non_null` → trường
 * null bị bỏ khỏi JSON → mọi trường nullable dùng `omittedOrNull`.
 */

import { z } from "zod";

import { DESIGN_ARTIFACT_ROLES, DESIGN_REASON_MAX, DESIGN_STATUSES } from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** `DesignDraftResponse.java:18-23`. Không có tên khách và SKU riêng (BE chưa trả). */
export const designDtoSchema = z.object({
  id: z.string(),
  customerId: omittedOrNull(z.string()),
  productId: z.string(),
  ownerUserId: omittedOrNull(z.string()),
  name: z.string(),
  spec: omittedOrNull(z.string()),
  status: z.enum(DESIGN_STATUSES),
  currentArtifactId: omittedOrNull(z.string()),
  reviewedBy: omittedOrNull(z.string()),
  reviewNotes: omittedOrNull(z.string()),
  /** Phải gửi lại khi quyết định (12 BR-11). */
  version: z.number().int(),
  parentSnapshotId: omittedOrNull(z.string()),
  productSlug: omittedOrNull(z.string()),
  sku: omittedOrNull(z.string()),
  templateCode: omittedOrNull(z.string()),
  reviewRequestedAt: omittedOrNull(z.string()),
  reviewedAt: omittedOrNull(z.string()),
  updatedAt: omittedOrNull(z.string()),
  previewArtifactId: omittedOrNull(z.string()),
  projectId: omittedOrNull(z.string()),
  /** Link ký ngắn hạn của ảnh xem trước hiện tại. */
  previewUrl: omittedOrNull(z.string()),
  variantName: omittedOrNull(z.string()),
  productName: omittedOrNull(z.string()),
});
export const designPageSchema = bePageSchema(designDtoSchema);

/** `DesignDecisionResponse.java:6`. `decision` để chuỗi: dòng cũ có thể mang mã ngoài `DesignDecisionType`. */
export const designDecisionDtoSchema = z.object({
  actorId: omittedOrNull(z.string()),
  artifactId: omittedOrNull(z.string()),
  decision: z.string(),
  notes: omittedOrNull(z.string()),
  version: z.number().int(),
  at: z.string(),
});
export const designDecisionPageSchema = bePageSchema(designDecisionDtoSchema);

/** `DesignArtifactResponse.java:7-9`. BE trả mọi file đã từng gửi, mới nhất trước. */
export const designArtifactDtoSchema = z.object({
  artifactId: z.string(),
  designId: z.string(),
  role: z.enum(DESIGN_ARTIFACT_ROLES),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  storedAt: z.string(),
  checksum: z.string(),
  documentChecksum: omittedOrNull(z.string()),
});
export const designArtifactListSchema = z.array(designArtifactDtoSchema);

/** `DesignPreflightResponse.java:9-12`. */
export const designPreflightDtoSchema = z.object({
  passed: z.boolean(),
  findings: z.array(z.object({ code: z.string(), detail: z.string(), blocking: z.boolean() })),
});

/** `ArtifactDownloadResponse` — kèm `Cache-Control: no-store`. */
export const artifactLinkSchema = z.object({ url: z.string(), expiresAt: z.string() });

/** `DesignQuoteRequestResponse.java` — yêu cầu báo giá đi kèm thiết kế. */
export const designQuoteRequestDtoSchema = z.object({
  id: z.string(),
  designId: z.string(),
  designName: omittedOrNull(z.string()),
  designStatus: omittedOrNull(z.string()),
  customerId: omittedOrNull(z.string()),
  customerName: omittedOrNull(z.string()),
  sku: omittedOrNull(z.string()),
  customerSku: omittedOrNull(z.string()),
  returnReason: omittedOrNull(z.string()),
  cartons: z.number().int(),
  desiredDeliveryDate: omittedOrNull(z.string()),
  status: z.string(),
  requestedBy: omittedOrNull(z.string()),
  requestedAt: z.string(),
  closedAt: omittedOrNull(z.string()),
  closedBy: omittedOrNull(z.string()),
});
export const designQuoteRequestListSchema = z.array(designQuoteRequestDtoSchema);

/* ── Input ───────────────────────────────────────────────────────────── */

const reasonTooLong = `Tối đa ${DESIGN_REASON_MAX} ký tự`;

/**
 * Quyết định của Quản lý bán hàng — kltn-docs 12 BR-06 / BR-11; BE `DesignReviewService.java:170-182`,
 * `DesignReviewController.DecisionRequest`: trả lại thì lý do sau khi bỏ khoảng trắng dài 1–2000; duyệt thì ghi chú tuỳ
 * chọn, ≤ 2000. Gửi bản đã bỏ khoảng trắng (BE kiểm `@Size(max = 2000)` trên chuỗi thô).
 */
export const designDecisionInputSchema = z.discriminatedUnion("approved", [
  z.object({
    approved: z.literal(true),
    notes: z
      .string()
      .trim()
      .max(DESIGN_REASON_MAX, reasonTooLong)
      .optional()
      .transform((value) => (value ? value : undefined)),
  }),
  z.object({
    approved: z.literal(false),
    notes: z
      .string()
      .trim()
      .min(1, "Nhập lý do trả lại để khách biết cần sửa gì")
      .max(DESIGN_REASON_MAX, reasonTooLong),
  }),
]);

/** Form "Trả lại" (react-hook-form). */
export const designReturnInputSchema = designDecisionInputSchema.options[1];

/* ── Vòng duyệt dự án ───────────────────────────────────────────────── */

/** `DesignReviewRoundResponse.java` — `design` chỉ có khi thiết kế đang chờ hoặc đã duyệt; bị trả lại thì chỉ còn id + outcome. */
export const reviewRoundDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  customerId: z.string(),
  customerName: omittedOrNull(z.string()),
  submittedBy: z.string(),
  submittedAt: z.string(),
  /** Vòng tự đóng khi mọi thiết kế có outcome (12 BR-20). */
  closedAt: omittedOrNull(z.string()),
  designs: z.array(
    z.object({
      designId: z.string(),
      design: omittedOrNull(designDtoSchema),
      /** Vắng khi thiết kế còn chờ. */
      outcome: omittedOrNull(z.enum(["APPROVED", "RETURNED"])),
      decidedAt: omittedOrNull(z.string()),
    }),
  ),
});
export const reviewRoundPageSchema = bePageSchema(reviewRoundDtoSchema);

/** `DesignRoundApprovalResponse.java` — `SKIPPED` kèm `CONFLICT`; `NOT_APPROVED` kèm mã lỗi của lần duyệt đó. */
export const roundApprovalDtoSchema = z.object({
  outcomes: z.array(
    z.object({
      designId: z.string(),
      outcome: z.enum(["APPROVED", "NOT_APPROVED", "SKIPPED"]),
      errorCode: omittedOrNull(z.string()),
      message: omittedOrNull(z.string()),
    }),
  ),
  round: reviewRoundDtoSchema,
});
