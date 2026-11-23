/**
 * Schema nhập liệu của các form hoá đơn điện tử (docs ecommerce/21-e-invoice) — tách khỏi DTO của BE
 * (`schemas.ts`, api-conventions §3.1). Giới hạn theo BE request DTO, ở `@/constants/einvoice`.
 */

import { z } from "zod";

import {
  EINVOICE_LIMITS,
  EXTERNAL_REDUCTION_BASES,
  MANUAL_CORRECTION_BASES,
  PORTAL_RESULT_OUTCOMES,
  PROVIDER_ENVIRONMENTS,
} from "@/constants/einvoice";
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
 * DELIVERY_FAILED không lập tay được (BE `CorrectionBasis.systemOnly()`).
 */
export const adjustInputSchema = z
  .object({
    basis: z.enum(MANUAL_CORRECTION_BASES),
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

/** Lập nháp thủ công cho shipment đã giao (BE `DrawUpEInvoiceRequest`); không shipment = phần phí còn lại (vận chuyển, phí khuôn — BE-62). */
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

/**
 * Ký hiệu theo NCC (BO-10, BE `useSeries`): NCC thật bắt buộc mã mẫu của NCC (SInvoice `1/001`, SePay); sandbox không
 * có mã mẫu riêng — ô bị ẩn và không gửi.
 */
export function seriesInputSchemaFor(sandbox: boolean) {
  return seriesInputSchema
    .transform((value) => (sandbox ? { ...value, providerTemplateCode: undefined } : value))
    .superRefine((value, ctx) => {
      if (!sandbox && value.providerTemplateCode === undefined)
        ctx.addIssue({
          code: "custom",
          path: ["providerTemplateCode"],
          message: "Nhập mã mẫu của nhà cung cấp",
        });
    });
}

export const registerRangeInputSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { path: ["to"], message: "Đến ngày phải sau từ ngày" });

/* ── Ghi lại từ cổng NCC (WF-05 Q-8: F-13) ─────────────────────────────────────────────── */

const isXml = (file: File) => /\.xml$/i.test(file.name) || /xml/.test(file.type);
const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

const optionalFile = (check: (file: File) => boolean, message: string) =>
  z
    .instanceof(File)
    .nullable()
    .refine((file) => file === null || check(file), message)
    .transform((file) => file ?? undefined);

const invoiceNumberText = z
  .string()
  .trim()
  .regex(/^\d{1,8}$/, "Số hoá đơn là số nguyên dương")
  .transform(Number)
  .refine((value) => value > 0, "Số hoá đơn là số nguyên dương");

/**
 * Kết quả đã kiểm trên cổng NCC cho hoá đơn kẹt "đang gửi" (BE F-13): đã phát hành → bắt buộc số hoá đơn; cơ quan thuế
 * từ chối → chỉ ghi chú. Tệp XML / PDF tuỳ chọn; BE đối chiếu với bản ghi tra lại từ NCC.
 */
export const portalResultInputSchema = z
  .object({
    outcome: z.enum(PORTAL_RESULT_OUTCOMES),
    invoiceNumber: z.string(),
    taxAuthorityCode: optionalText(L.providerCodeMax),
    lookupCode: optionalText(L.providerCodeMax),
    xml: optionalFile(isXml, "Tệp hoá đơn phải là XML"),
    pdf: optionalFile(isPdf, "Bản xem phải là tệp PDF"),
    note: z
      .string()
      .trim()
      .min(1, "Nhập ghi chú: đã kiểm gì trên cổng nhà cung cấp")
      .max(L.noteMax, `Tối đa ${L.noteMax} ký tự`),
  })
  .transform((value, ctx) => {
    if (value.outcome !== "ISSUED") return { ...value, invoiceNumber: undefined };
    const number = invoiceNumberText.safeParse(value.invoiceNumber);
    if (!number.success) {
      ctx.addIssue({
        code: "custom",
        path: ["invoiceNumber"],
        message: "Nhập số hoá đơn đã phát hành trên cổng",
      });
      return z.NEVER;
    }
    return { ...value, invoiceNumber: number.data };
  });

/**
 * Hoá đơn giảm Kế toán đã lập trên cổng NCC (BE G3 `external-reductions`): ký hiệu, mẫu số, số, ngày (không ở tương
 * lai), tệp PDF và tệp XML BẮT BUỘC (BE G3: XML là hoá đơn theo luật, số đã nhập được đối chiếu với nó — thiếu thì 400),
 * ghi chú bắt buộc ≤ 500. Căn cứ: giao thất bại (mặc định) hoặc trả hàng — trả hàng phải nêu yêu cầu trả hàng.
 */
export const externalReductionInputSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(L.symbolPattern, "Ký hiệu dạng C26TAA: C/K, 2 số năm, loại hoá đơn, 2 chữ"),
    templateCode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z/]{1,20}$/, "Nhập mẫu số (tối đa 20 ký tự chữ, số, /)"),
    invoiceNumber: invoiceNumberText,
    issueDate: isoDate.refine((d) => d <= todayInVietnam(), "Ngày hoá đơn không được ở tương lai"),
    pdf: z
      .instanceof(File, { message: "Chọn tệp PDF của hoá đơn giảm" })
      .refine(isPdf, "Bản xem phải là tệp PDF"),
    xml: z
      .instanceof(File, { message: "Chọn tệp XML của hoá đơn giảm" })
      .refine(isXml, "Tệp hoá đơn phải là XML"),
    note: z.string().trim().min(1, "Nhập ghi chú").max(L.noteMax, `Tối đa ${L.noteMax} ký tự`),
    basis: z.enum(EXTERNAL_REDUCTION_BASES),
    returnRequestId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.basis === "RETURN" && !value.returnRequestId) {
      ctx.addIssue({
        code: "custom",
        path: ["returnRequestId"],
        message: "Hoá đơn giảm vì trả hàng phải nêu yêu cầu trả hàng",
      });
    }
  })
  .transform(({ returnRequestId, ...value }) => ({
    ...value,
    returnRequestId: value.basis === "RETURN" ? returnRequestId : undefined,
  }));
