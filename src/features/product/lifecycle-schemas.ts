/**
 * Cuối vòng đời sản phẩm (BE SCRUM-461): tạm ngưng / tiếp tục, xoá bản nháp, tham chiếu còn mở,
 * cảnh báo khi ngừng kinh doanh, lịch sử thay đổi.
 *
 *   POST   /products/{id}/suspension      { reason, version }   APPROVED | PUBLISHED → INACTIVE
 *   POST   /products/{id}/resumption      { version }           INACTIVE → APPROVED
 *   DELETE /products/{id}?version=        chỉ sản phẩm DRAFT (BR-02 docs 01)
 *   GET    /products/{id}/open-references
 *   GET    /products/{id}/versions        PageResponse, mới nhất trước
 */

import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";

/** `product.products.suspend_reason` / `discontinue_reason` — `Product.MAX_REASON_LENGTH`. */
export const PRODUCT_REASON_MAX = 500;

const versionSchema = z.number().int().min(0);

/** BE `SuspendProductRequest`: lý do bắt buộc (1–500) + `version` của lần đọc trước. */
export const suspendProductSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Lý do tạm ngưng là bắt buộc")
    .max(PRODUCT_REASON_MAX, `Lý do tối đa ${PRODUCT_REASON_MAX} ký tự`),
  version: versionSchema,
});

/** BE `ResumeProductRequest` / `DELETE ?version=`: chỉ cần `version` của lần đọc trước. */
export const productVersionOnlySchema = z.object({ version: versionSchema });

/** BE `SkuReference.Kind` — loại chứng từ còn mở tham chiếu SKU của sản phẩm. */
export const OPEN_REFERENCE_KINDS = ["PURCHASE_ORDER_LINE", "SALES_ORDER_LINE"] as const;

/** BE `OpenReferenceResponse`. */
export const openReferenceSchema = z.object({
  kind: z.enum(OPEN_REFERENCE_KINDS),
  documentNumber: z.string(),
  documentId: z.string(),
  sku: z.string(),
});
export type OpenReference = z.infer<typeof openReferenceSchema>;

/** BE `OpenReferencesResponse` — tối đa 20, lấy lần lượt từng loại; `truncated` = còn nữa. */
export const openReferencesSchema = z.object({
  references: z.array(openReferenceSchema),
  truncated: z.boolean(),
});
export type OpenReferences = z.infer<typeof openReferencesSchema>;

/**
 * BE `ProductDiscontinuationResponse` (phần ngoài các trường sản phẩm, nằm cùng cấp nhờ
 * `@JsonUnwrapped`): cảnh báo — KHÔNG phải lỗi, sản phẩm đã ngừng kinh doanh (BR-PRD-005, docs 01 §5.1).
 */
export const discontinuationExtrasSchema = z.object({
  warnings: z.array(z.string()),
  openReferences: z.array(openReferenceSchema),
  openReferencesTruncated: z.boolean(),
});

/** BE `ProductChangeType` — loại một dòng lịch sử. */
export const PRODUCT_CHANGE_TYPES = [
  "CREATED",
  "UPDATED",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "RESUMED",
  "DISCONTINUED",
  "VARIANT_ADDED",
  "VARIANT_UPDATED",
  "VARIANT_STATUS",
  "MEDIA",
  "LOGISTICS",
  "INVENTORY_CONTROL",
] as const;
export type ProductChangeType = (typeof PRODUCT_CHANGE_TYPES)[number] | "UNKNOWN";

/** BE `ProductChangeType.Subject`. */
export const PRODUCT_CHANGE_SUBJECTS = [
  "PRODUCT",
  "VARIANT",
  "MEDIA",
  "LOGISTICS",
  "INVENTORY_CONTROL",
] as const;

/** BE `ProductVersionResponse` — một dòng lịch sử thay đổi (mới nhất trước). */
export const productVersionSchema = z.object({
  /** CREATE / UPDATE / TRANSITION / APPROVE / REJECT — suy ra từ `changeType`, FE dùng `changeType`. */
  action: z.string(),
  /** "system" khi do job / listener thực hiện. */
  actorName: z.string().nullish(),
  outcome: z.string(),
  occurredAt: z.string(),
  // Loại / đối tượng BE thêm sau → "UNKNOWN" thay vì làm hỏng cả trang lịch sử (cùng cách với
  // `beProductStatusSchema`); `lifecycle-labels.ts` hiện câu chung.
  changeType: z.enum([...PRODUCT_CHANGE_TYPES, "UNKNOWN"]).catch("UNKNOWN"),
  subjectType: z.enum([...PRODUCT_CHANGE_SUBJECTS, "UNKNOWN"]).catch("UNKNOWN"),
  /** Biến thể / ảnh / SKU liên quan; trống với bản thân sản phẩm. */
  subjectId: z.string().nullish(),
  fromStatus: z.string().nullish(),
  toStatus: z.string().nullish(),
  reason: z.string().nullish(),
  changedFields: z.array(z.string()).nullish(),
});
export type ProductVersion = z.infer<typeof productVersionSchema>;

export const productVersionPageSchema = bePageSchema(productVersionSchema);
export type ProductVersionPage = z.infer<typeof productVersionPageSchema>;
