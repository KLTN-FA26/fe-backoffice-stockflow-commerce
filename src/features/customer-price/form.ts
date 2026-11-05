/**
 * Form tạo / sửa bảng giá khách hàng (lớp Input của form, api-conventions §3.1). Ô nhập là CHUỖI tới lúc
 * tuần tự hoá; mọi luật nghiệp vụ là của `customerPriceValuesSchema` (Step 4A, chép từ BE) — ở đây chỉ
 * thêm hai chặn của riêng form:
 *  - đơn giá chỉ nhận CHỮ SỐ: người dùng VN gõ "95.000" nghĩa là 95 nghìn, nhưng schema / BE đọc là 95,000
 *    → 95 VND; chặn để không lưu nhầm giá thấp 1.000 lần;
 *  - bậc có giá cũ không chính xác (`unitPriceExact: false`, JSON đã làm tròn) để TRỐNG và bắt nhập lại —
 *    không bao giờ gửi lại số đã bị làm tròn như thể chính xác.
 * Thứ tự bậc giữ đúng như trên form (không sắp lại trước khi gửi) để `tiers[i]` trong lỗi của BE trỏ
 * đúng dòng đã gửi; BE tự sắp khi lưu.
 */
import { z } from "zod";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";

import { customerPriceValuesSchema } from "./schemas";

import type { CustomerPrice, CustomerPriceValues } from "./schemas";

const F = CUSTOMER_PRICE_UI_LABELS.form;
/** BE `CustomerPriceService.sku`: strip + in hoa, dạng `ck_variants_sku`. */
export const CUSTOMER_PRICE_SKU = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const DIGITS = /^\d+$/;

export interface TierFormValue {
  minQuantity: string;
  unitPrice: string;
  /** Bậc nạp từ BE có giá không chính xác — ô giá để trống, bắt nhập lại (không gửi đi). */
  inexact: boolean;
}

export interface CustomerPriceFormValues {
  sku: string;
  tiers: TierFormValue[];
  note: string;
}

export const emptyTier = (): TierFormValue => ({ minQuantity: "", unitPrice: "", inexact: false });

export const emptyCustomerPriceForm = (): CustomerPriceFormValues => ({
  sku: "",
  tiers: [emptyTier()],
  note: "",
});

/** Bản của BE → ô nhập. Giá không chính xác KHÔNG được đổ vào ô (để trống + cờ `inexact`). */
export function customerPriceToForm(price: CustomerPrice): CustomerPriceFormValues {
  return {
    sku: price.sku,
    tiers: price.tiers.map((t) => ({
      minQuantity: String(t.minQuantity),
      unitPrice: t.unitPriceExact ? t.unitPrice : "",
      inexact: !t.unitPriceExact,
    })),
    note: price.note ?? "",
  };
}

/** Ô số lượng: chữ số → số nguyên; sai dạng → NaN để schema báo đúng ô. */
const quantityOf = (raw: string) => (DIGITS.test(raw.trim()) ? Number(raw.trim()) : Number.NaN);

/** Ô nhập → `CustomerPriceValues` theo đúng thứ tự trên form; ghi chú trống thành null (BE `noteOf`). */
export function formToCustomerPriceValues(form: CustomerPriceFormValues): CustomerPriceValues {
  return {
    tiers: form.tiers.map((t) => ({
      minQuantity: quantityOf(t.minQuantity),
      unitPrice: t.unitPrice.trim(),
    })),
    note: form.note.trim() === "" ? null : form.note,
  };
}

export const normalizeSku = (raw: string) => raw.trim().toUpperCase();

/**
 * Kiểm form: SKU (chỉ khi tạo — khi sửa SKU là danh tính, không đổi), chữ số của đơn giá, rồi đúng
 * `customerPriceValuesSchema` cho mọi luật còn lại. Lỗi giữ đường dẫn `tiers.i.*` / `note`.
 */
export function customerPriceFormSchema(mode: "create" | "edit") {
  return z
    .object({
      sku: z.string(),
      tiers: z.array(
        z.object({ minQuantity: z.string(), unitPrice: z.string(), inexact: z.boolean() }),
      ),
      note: z.string(),
    })
    .superRefine((form, ctx) => {
      if (mode === "create" && !CUSTOMER_PRICE_SKU.test(normalizeSku(form.sku))) {
        ctx.addIssue({ code: "custom", path: ["sku"], message: F.skuInvalid });
      }
      const nonDigit = new Set<number>();
      form.tiers.forEach((t, i) => {
        const price = t.unitPrice.trim();
        if (price === "" && t.inexact) {
          ctx.addIssue({
            code: "custom",
            path: ["tiers", i, "unitPrice"],
            message: F.inexactReplace,
          });
          nonDigit.add(i);
        } else if (price !== "" && !DIGITS.test(price)) {
          ctx.addIssue({ code: "custom", path: ["tiers", i, "unitPrice"], message: F.digitsOnly });
          nonDigit.add(i);
        }
      });
      const parsed = customerPriceValuesSchema.safeParse(formToCustomerPriceValues(form));
      if (parsed.success) return;
      for (const issue of parsed.error.issues) {
        const [, index, field] = issue.path;
        // Ô giá đã báo lỗi riêng của form → không chồng thêm câu của schema lên cùng ô
        if (field === "unitPrice" && typeof index === "number" && nonDigit.has(index)) continue;
        ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
      }
    });
}

/** `tiers[0].unitPrice` của BE → `tiers.0.unitPrice` của react-hook-form (cùng chỉ số dòng đã gửi). */
export function serverFieldToFormPath(field: string): string {
  return field.replace(/\[(\d+)\]/g, ".$1");
}
