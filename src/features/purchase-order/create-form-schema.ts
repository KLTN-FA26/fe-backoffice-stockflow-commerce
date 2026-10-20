/**
 * Purchase Order — schema của FORM tạo PO (react-hook-form + zodResolver).
 *
 * Khác `createPoSchema` (payload gửi BE, `input-schemas.ts`): giá trị ở đây là CHUỖI người dùng
 * đang gõ, và mỗi lỗi gắn đúng path của ô (`lines.0.orderedQty`…) để hiện inline ngay dưới ô.
 * Trước khi gửi, form vẫn chuyển sang payload và parse lại bằng `createPoSchema` (chốt chặn cuối).
 * Ràng buộc = bean validation + domain rule BE nhánh `test` (cùng nguồn với `createPoSchema`).
 */

import { z } from "zod";

import { PO_CREATE_FIELD_MESSAGES, PO_LIMITS, UI_LABELS } from "@/constants";
import { fitsCurrencyScale } from "@/lib/format";

import { PO_INPUT_CURRENCIES, SKU_CODE_PATTERN, unitPriceScaleMessage } from "./input-schemas";
import { orderQuantityIssues, poQuantityTermsMessage } from "./line-terms";
import { isUnitPriceRequired } from "./selectors";

const toNumber = (raw: string) => (raw.trim() === "" ? Number.NaN : Number(raw));

const poLineTermsSchema = z.object({
  moq: z.number(),
  packSize: z.number(),
  price: z.number(),
  currency: z.string(),
  effectiveLeadTimeDays: z.number(),
});

export const poCreateFormLineSchema = z.object({
  // Bản chụp điều khoản danh mục NCC lúc chọn SKU; null = chưa chọn từ danh mục. Không gửi BE.
  terms: poLineTermsSchema.nullable(),
  // Id dòng đã lưu của PO nháp ("" = dòng mới). Không gửi BE ở màn tạo.
  lineId: z.string(),
  // BR-01 (docs 02 §6) + BE `common.domain.Sku` — xem `poLineInputSchema`. SKU chọn từ danh mục NCC.
  skuId: z
    .string()
    .min(1, UI_LABELS.purchaseOrder.validation.skuNotInCatalog)
    .regex(
      SKU_CODE_PATTERN,
      "Mã SKU chỉ gồm chữ in hoa, số, dấu chấm, gạch dưới, gạch ngang; tối đa 64 ký tự",
    ),
  // BE PR #71: bỏ trống thì BE lấy tên sản phẩm của SKU. `purchase_order_lines.note VARCHAR(255)`.
  description: z
    .string()
    .trim()
    .max(PO_LIMITS.lineDescriptionMax, `Mô tả tối đa ${PO_LIMITS.lineDescriptionMax} ký tự`),
  // BE `int quantityOrdered` @Positive.
  orderedQty: z.string().superRefine((raw, ctx) => {
    const n = toNumber(raw);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({ code: "custom", message: "SL đặt phải là số nguyên > 0" });
    } else if (n > PO_LIMITS.quantityMax) {
      ctx.addIssue({ code: "custom", message: "SL đặt vượt giới hạn cho phép" });
    }
  }),
  // BE PR #71 `unitPrice` > 0 (`ck_purchase_order_lines_price`). Số lẻ theo tiền tệ: kiểm ở form.
  // Trống = dùng giá danh mục; khi nào "trống" hợp lệ kiểm ở cấp form (cần `terms` + tiền tệ PO).
  unitPrice: z.string().refine((raw) => {
    if (raw.trim() === "") return true;
    const n = toNumber(raw);
    return Number.isFinite(n) && n > 0;
  }, UI_LABELS.purchaseOrder.validation.unitPriceRequired),
  // BE PR #71: thuế suất % của dòng, 0–100; để trống = 0.
  taxRate: z.string().refine((raw) => {
    if (raw.trim() === "") return true;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, "Thuế suất 0–100%"),
});

/**
 * Luật dòng theo danh mục NCC (cấp form vì cần tiền tệ PO):
 * - BR-01 (docs 02 §6): SKU thuộc danh mục NCC ⇒ có `skuId` thì phải có `terms`.
 * - docs 02 §4 bước 5 + BE BR-PO-001 (`SupplierItem.orderQuantityViolations`): MOQ, bội số quy cách.
 * - BR-07 (docs 02 §6): một tiền tệ/PO ⇒ chỉ điền giá danh mục khi cùng tiền tệ PO. Dòng đã lưu
 *   (`lineId` ≠ "") phải giữ giá thương lượng — bỏ giá = BE thay bằng giá danh mục (issue #30 §2).
 */
function checkCatalogTerms(
  line: PoCreateFormLine,
  index: number,
  poCurrency: string,
  ctx: z.RefinementCtx,
  savedLinesWithoutTerms = false,
): void {
  const V = UI_LABELS.purchaseOrder.validation;
  const issue = (field: string, message: string) =>
    ctx.addIssue({ code: "custom", message, path: ["lines", index, field] });
  const { terms } = line;
  const unknownTerms = savedLinesWithoutTerms && line.lineId !== "";
  if (line.skuId && terms === null && !unknownTerms) issue("skuId", V.skuNotInCatalog);
  if (terms) {
    const qty = toNumber(line.orderedQty);
    if (Number.isInteger(qty) && qty > 0 && orderQuantityIssues(qty, terms).length > 0) {
      issue("orderedQty", poQuantityTermsMessage(terms));
    }
  }
  // Một luật cho ô bắt buộc / giá hiệu lực / tổng tiền (`isUnitPriceRequired`); ở đây chỉ chọn câu.
  if (line.unitPrice.trim() !== "" || !isUnitPriceRequired(line, poCurrency)) return;
  if (line.lineId !== "") issue("unitPrice", V.unitPriceKeepNegotiated);
  else if (!terms) issue("unitPrice", V.unitPriceRequired);
  else {
    issue(
      "unitPrice",
      V.unitPriceCurrencyMismatch.replace("{catalog}", terms.currency).replace("{po}", poCurrency),
    );
  }
}

export type PoFormSchemaOptions = {
  requireExpectedDate: boolean;
  /** Ngày đặt của PO (`orderDate`) — chỉ có ở màn sửa nháp; ngày giao không được trước ngày này. */
  minExpectedDate?: string;
  /** Sửa nháp: tiền tệ cố định theo PO (BR-07 docs 02 §6) — nhận mã ISO ngoài danh sách màn tạo. */
  currencyFixed?: boolean;
  /** Màn sửa nháp: BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200) — báo ngay ở bước Dòng hàng. */
  maxLines?: number;
  /** Sửa nháp thiếu quyền đọc danh mục: dòng đã lưu bỏ kiểm BR-01 ở FE (BE `checkLines` vẫn kiểm). */
  savedLinesWithoutTerms?: boolean;
};

const ISO_CURRENCY = /^[A-Z]{3}$/;

function isInputCurrency(code: string): boolean {
  return (PO_INPUT_CURRENCIES as readonly string[]).includes(code);
}

function linesSchema(maxLines: number | undefined) {
  const lines = z.array(poCreateFormLineSchema).min(1, PO_CREATE_FIELD_MESSAGES.lines);
  return maxLines === undefined
    ? lines
    : lines.max(maxLines, UI_LABELS.purchaseOrder.draftEdit.linesMaxError(maxLines));
}

export function poFormSchema(options: PoFormSchemaOptions) {
  return z
    .object({
      supplierId: z.string().min(1, UI_LABELS.purchaseOrder.validation.supplierRequired),
      // SCRUM-390 (docs 02 §3): kho nhận bắt buộc.
      warehouseId: z.string().min(1, UI_LABELS.purchaseOrder.validation.warehouseRequired),
      // BR-07 (docs 02 §6): một PO một tiền tệ — chọn ở cấp PO (màn tạo: danh sách chọn; màn sửa:
      // tiền tệ của PO, không đổi được).
      currency: z
        .string()
        .refine(
          (code) => (options.currencyFixed ? ISO_CURRENCY.test(code) : isInputCurrency(code)),
          {
            message: PO_CREATE_FIELD_MESSAGES.currency,
          },
        ),
      // BR-06 (docs 02 §6): ngày đã qua chỉ CẢNH BÁO; trống → BE tự đặt hôm nay + leadTimeDays.
      expectedDate: options.requireExpectedDate
        ? z.string().min(1, UI_LABELS.purchaseOrder.validation.expectedDateRequired)
        : z.string(),
      // BE PR #71 `purchase_orders.note` (text) — FE giới hạn như `createPoSchema`.
      note: z.string().max(PO_LIMITS.noteMax, `Ghi chú tối đa ${PO_LIMITS.noteMax} ký tự`),
      lines: linesSchema(options.maxLines),
    })
    .superRefine((form, ctx) => {
      // BE `PurchaseOrder#reviseDraft`: ngày giao trước ngày đặt ⇒ 400 VALIDATION_FAILED không kèm
      // fieldErrors — chặn ở ô. Trước HÔM NAY nhưng sau ngày đặt thì vẫn chỉ cảnh báo (BR-06).
      const { minExpectedDate } = options;
      if (minExpectedDate && form.expectedDate !== "" && form.expectedDate < minExpectedDate) {
        ctx.addIssue({
          code: "custom",
          message: UI_LABELS.purchaseOrder.validation.expectedBeforeOrderDate,
          path: ["expectedDate"],
        });
      }
      const seen = new Set<string>();
      form.lines.forEach((line, i) => {
        // ASSUMPTION (chưa có open-question): chặn SKU trùng trong cùng PO — xem `createPoSchema`.
        if (line.skuId && seen.has(line.skuId)) {
          ctx.addIssue({
            code: "custom",
            message: UI_LABELS.purchaseOrder.validation.skuDuplicate,
            path: ["lines", i, "skuId"],
          });
        }
        seen.add(line.skuId);
        checkCatalogTerms(line, i, form.currency, ctx, options.savedLinesWithoutTerms);
        // BR-07 + BE `Money` HALF_UP theo số lẻ của tiền tệ (VND: số nguyên).
        const price = toNumber(line.unitPrice);
        if (Number.isFinite(price) && price >= 0 && !fitsCurrencyScale(price, form.currency)) {
          ctx.addIssue({
            code: "custom",
            message: unitPriceScaleMessage(form.currency),
            path: ["lines", i, "unitPrice"],
          });
        }
      });
    });
}

// Giữ tương thích nơi đang dùng schema tạo PO (không bắt buộc ngày giao).
export const poCreateFormSchema = poFormSchema({ requireExpectedDate: false });

export type PoCreateFormValues = z.infer<ReturnType<typeof poFormSchema>>;
export type PoCreateFormLine = z.infer<typeof poCreateFormLineSchema>;
