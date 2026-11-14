/**
 * Schema nhập liệu của các form hoá đơn điện tử (docs ecommerce/21-e-invoice) — tách khỏi DTO của BE
 * (`schemas.ts`, api-conventions §3.1). Giới hạn theo BE request DTO, ở `@/constants/einvoice`.
 */

import { z } from "zod";

import { EINVOICE_LIMITS, PROVIDER_ENVIRONMENTS } from "@/constants/einvoice";
import { toLocalIsoDate } from "@/lib/format/date";
import { isoDate } from "@/lib/validation/primitives";

const L = EINVOICE_LIMITS;

const todayInVietnam = () => toLocalIsoDate(new Date().toISOString());

const reason = z
  .string()
  .trim()
  .min(1, "Nhập lý do")
  .max(L.reasonMax, `Tối đa ${L.reasonMax} ký tự`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .transform((value) => (value === "" ? undefined : value));

/** Huỷ nháp chưa từng gửi nhà cung cấp — bắt buộc lý do (docs 21 §4.5 bước 14). */
export const voidDraftInputSchema = z.object({ reason });

/**
 * Sửa nháp: thông tin bên mua trên hoá đơn và tên dòng; số lượng / giá là của hợp đồng, không sửa
 * (BE `ReviseEInvoiceRequest`). Mã số thuế đúng định dạng (docs 18 BR-01, 21 BR-06).
 */
export const reviseDraftInputSchema = z.object({
  buyerName: optionalText(L.buyerNameMax),
  buyerTaxCode: z
    .string()
    .trim()
    .max(L.buyerTaxCodeMax)
    .refine((v) => v === "" || L.taxCodePattern.test(v), "Mã số thuế gồm 10 số, 10-3 hoặc 12 số")
    .transform((v) => (v === "" ? undefined : v)),
  buyerAddress: optionalText(L.buyerAddressMax),
  buyerEmail: z
    .string()
    .trim()
    .max(L.buyerEmailMax)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email không hợp lệ")
    .transform((v) => (v === "" ? undefined : v)),
});

const correctionBuyer = z
  .object({
    name: optionalText(L.buyerNameMax),
    taxCode: z
      .string()
      .trim()
      .refine((v) => v === "" || L.taxCodePattern.test(v), "Mã số thuế gồm 10 số, 10-3 hoặc 12 số")
      .transform((v) => (v === "" ? undefined : v)),
    address: optionalText(L.buyerAddressMax),
    email: optionalText(L.buyerEmailMax),
  })
  .optional();

/** Một dòng chỉnh: tham chiếu dòng gốc; số lượng có dấu (âm = giảm) ở điều chỉnh, ≥ 0 ở thay thế. */
const correctionLine = z.object({
  originalLineId: z.string().min(1),
  quantity: z.number().int().optional(),
  unitPrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  itemName: optionalText(L.lineNameMax).optional(),
});

/**
 * Lập điều chỉnh (docs 21 §4.4; TT 91/2026 Điều 10): RETURN và TRADE_DISCOUNT chỉ giảm — mọi số
 * lượng chỉnh phải ≤ 0 (BE `CorrectionBasis`); ERROR cần thoả thuận trước khi phát hành.
 */
export const adjustInputSchema = z
  .object({
    basis: z.enum(["ERROR", "RETURN", "TRADE_DISCOUNT"]),
    reason,
    buyer: correctionBuyer,
    lines: z.array(correctionLine).max(L.linesMax, `Tối đa ${L.linesMax} dòng`),
    returnRequestId: z.string().optional(),
    listedInvoiceIds: z.array(z.string()).max(L.linesMax).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.basis === "ERROR" && value.lines.length === 0 && !value.buyer) {
      ctx.addIssue({ code: "custom", path: ["lines"], message: "Chọn ít nhất một dòng cần chỉnh" });
    }
    if (value.basis !== "ERROR") {
      // docs 21 §4.4 (trả hàng, chiết khấu): chỉ điều chỉnh giảm
      value.lines.forEach((line, index) => {
        if (line.quantity !== undefined && line.quantity > 0)
          ctx.addIssue({
            code: "custom",
            path: ["lines", index, "quantity"],
            message: "Trả hàng / chiết khấu chỉ điều chỉnh giảm (số âm)",
          });
      });
      if (value.lines.length === 0)
        ctx.addIssue({ code: "custom", path: ["lines"], message: "Chọn ít nhất một dòng giảm" });
    }
    if (value.basis === "RETURN" && !value.returnRequestId) {
      ctx.addIssue({
        code: "custom",
        path: ["returnRequestId"],
        message: "Điều chỉnh vì trả hàng phải nêu yêu cầu trả hàng",
      });
    }
  });

/** Lập thay thế (docs 21 §4.4): ghi lại toàn bộ nội dung — số lượng 0 bỏ dòng, không âm. */
export const replaceInputSchema = z.object({
  reason,
  buyer: correctionBuyer,
  lines: z
    .array(correctionLine.extend({ quantity: z.number().int().min(0).optional() }))
    .max(L.linesMax),
});

/** Gắn văn bản thoả thuận: số ≤ 64 ký tự, ngày không ở tương lai, tệp PDF (BE `attachAgreement`). */
export const agreementInputSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Nhập số văn bản")
    .max(L.agreementNumberMax, `Tối đa ${L.agreementNumberMax} ký tự`),
  date: isoDate.refine((d) => d <= todayInVietnam(), "Ngày thoả thuận không được ở tương lai"),
  file: z
    .instanceof(File, { message: "Chọn tệp PDF đã ký" })
    .refine((f) => f.type === "application/pdf", "Văn bản thoả thuận phải là tệp PDF"),
});

/**
 * Thông báo sai sót 04/SS-HDDT (TT 91/2026 Điều 10 khoản 1 điểm a): sai tên / địa chỉ bên mua, mã số
 * thuế đúng — không lập hoá đơn mới. Phải nêu ít nhất tên hoặc địa chỉ đúng.
 */
export const errorNoticeInputSchema = z
  .object({
    reason,
    correctBuyerName: optionalText(L.buyerNameMax),
    correctBuyerAddress: optionalText(L.buyerAddressMax),
  })
  .refine((v) => v.correctBuyerName !== undefined || v.correctBuyerAddress !== undefined, {
    path: ["correctBuyerName"],
    message: "Nêu tên hoặc địa chỉ đúng của bên mua",
  });

/** Lập nháp thủ công cho shipment đã giao (BE `DrawUpEInvoiceRequest`); không shipment = phần phí vận chuyển còn lại. */
export const drawUpInputSchema = z.object({
  orderId: z.string().min(1, "Chọn đơn hàng"),
  shipmentId: z.string().optional(),
});

/* ── Cấu hình (System Admin, docs 21 BR-10) ─────────────────────────────────────────── */

export const providerAccountInputSchema = z.object({
  environment: z.enum(PROVIDER_ENVIRONMENTS),
  username: z.string().trim().min(1, "Nhập tài khoản").max(200),
  /** Bỏ trống = giữ mật khẩu đã lưu (BE không trả lại mật khẩu). */
  secret: z
    .string()
    .max(500)
    .transform((v) => (v === "" ? undefined : v)),
});

export const seriesInputSchema = z.object({
  templateCode: z.literal("1"),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(L.symbolPattern, "Ký hiệu dạng C26TAA: C/K, 2 số năm, loại hoá đơn, 2 chữ"),
  year: z.number().int().min(L.yearMin).max(L.yearMax),
  providerTemplateCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z/]{0,20}$/, "Tối đa 20 ký tự chữ, số, /")
    .transform((v) => (v === "" ? undefined : v)),
});

export const registerRangeInputSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { path: ["to"], message: "Đến ngày phải sau từ ngày" });
