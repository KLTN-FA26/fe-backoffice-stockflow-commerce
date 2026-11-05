/**
 * Supplier item — schema form danh mục hàng NCC (lớp Input, api-conventions §3.1).
 *
 * Giá trị là chuỗi người dùng đang gõ; `toSaveSupplierItemRequest` (item-api.ts) mới đổi sang số.
 * Luật chép từ BE `SupplierItemTerms` / `SaveSupplierItemRequest`, nguồn nghiệp vụ docs 02 §4
 * bước 5 (MOQ, bội số quy cách đóng gói).
 */

import { z } from "zod";

import { SUPPLIER_ITEM_FIELD_MESSAGES, SUPPLIER_ITEM_LIMITS } from "@/constants";
import { fitsCurrencyScale } from "@/lib/format";
import { SKU_CODE_PATTERN } from "@/lib/validation/sku";

const DIGITS = /^\d+$/;
const DECIMAL = /^\d+(\.\d+)?$/;

/** Người dùng VN hay gõ dấu phẩy thập phân ("12,5") — chuẩn về dấu chấm trước khi kiểm / gửi BE. */
export function normalizeDecimal(raw: string): string {
  return raw.trim().replace(",", ".");
}

/** Số chữ số phần nguyên (bỏ số 0 đầu) — so `@Digits(integer = 16)` của BE, không qua `Number`. */
function integerDigits(raw: string): number {
  return (raw.split(".")[0] ?? "").replace(/^0+(?=\d)/, "").length;
}

function decimalPlaces(raw: string): number {
  return (raw.split(".")[1] ?? "").length;
}

/** Số nguyên không âm từ chuỗi; `null` khi không đúng dạng. */
function parseInteger(raw: string): number | null {
  return DIGITS.test(raw) ? Number(raw) : null;
}

const positiveIntegerText = (message: string) =>
  z
    .string()
    .trim()
    .refine(
      (raw) => {
        const n = parseInteger(raw) ?? 0;
        return n >= 1 && n <= SUPPLIER_ITEM_LIMITS.intMax;
      },
      { message },
    );

export function supplierItemFormSchema(currency: string | null) {
  return (
    z
      .object({
        // SKU: server `strip()` + `toUpperCase()` rồi so `SKU_CODE_PATTERN` (BE `Sku`)
        sku: z
          .string()
          .trim()
          .toUpperCase()
          .refine((sku) => SKU_CODE_PATTERN.test(sku), {
            message: SUPPLIER_ITEM_FIELD_MESSAGES.sku,
          }),
        // BE `@Size(max = 50)`; rỗng → null
        supplierSkuCode: z.string().trim().max(SUPPLIER_ITEM_LIMITS.supplierSkuCodeMax, {
          message: SUPPLIER_ITEM_FIELD_MESSAGES.supplierSkuCode,
        }),
        // BE `SupplierItemTerms`: giá > 0, số lẻ ≤ min(2, số lẻ tiền tệ NCC)
        price: z
          .string()
          .trim()
          .transform(normalizeDecimal)
          .refine(
            (raw) =>
              DECIMAL.test(raw) &&
              Number(raw) > 0 &&
              decimalPlaces(raw) <= SUPPLIER_ITEM_LIMITS.priceMaxScale &&
              integerDigits(raw) <= SUPPLIER_ITEM_LIMITS.priceIntegerDigitsMax &&
              // Chưa biết tiền tệ (danh mục rỗng) → để BE quyết theo tiền tệ NCC
              (currency === null || fitsCurrencyScale(Number(raw), currency)),
            { message: SUPPLIER_ITEM_FIELD_MESSAGES.price },
          ),
        // BE `SupplierItemTerms`: moq ≥ 1, packSize ≥ 1
        moq: positiveIntegerText(SUPPLIER_ITEM_FIELD_MESSAGES.moq),
        packSize: positiveIntegerText(SUPPLIER_ITEM_FIELD_MESSAGES.packSize),
        // BE: rỗng/null = dùng lead time mặc định của NCC; có giá trị thì 0–365
        leadTimeDays: z
          .string()
          .trim()
          .refine(
            (raw) => {
              if (raw === "") return true;
              const days = parseInteger(raw);
              return days !== null && days <= SUPPLIER_ITEM_LIMITS.leadTimeDaysMax;
            },
            { message: SUPPLIER_ITEM_FIELD_MESSAGES.leadTimeDays },
          ),
        preferred: z.boolean(),
      })
      // BE SupplierItemTerms (SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE) + docs 02 §4 bước 5:
      // MOQ phải là bội số của quy cách đóng gói
      .superRefine((values, ctx) => {
        const moq = parseInteger(values.moq.trim());
        const packSize = parseInteger(values.packSize.trim());
        if (
          moq !== null &&
          packSize !== null &&
          packSize >= 1 &&
          moq >= 1 &&
          moq % packSize !== 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["moq"],
            message: SUPPLIER_ITEM_FIELD_MESSAGES.moq,
          });
        }
      })
  );
}
