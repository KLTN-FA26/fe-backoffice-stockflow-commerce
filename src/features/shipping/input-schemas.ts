/**
 * Shipping — Input schemas (quét kiện, bàn giao). Backend phải re-check mọi rule dưới đây.
 */

import { z } from "zod";

import { SHIPPING_FIELD_MESSAGES as MSG, SHIPPING_LIMITS } from "@/constants";

/** Mã vạch kiện chỉ gồm ký tự ASCII in được, không khoảng trắng. */
const PRINTABLE_ASCII = /^[\x21-\x7E]+$/;

/**
 * Mã kiện quét lên xe — BE so khớp không phân biệt hoa thường (ASSUMPTION contract SCRUM-288).
 * Bộ gõ tiếng Việt đang bật có thể biến ký tự máy quét gửi thành chữ có dấu → chặn sớm, báo rõ cách
 * sửa thay vì để BE trả "không tìm thấy kiện".
 */
export const scanPackageInputSchema = z.object({
  packageCode: z
    .string()
    .trim()
    .min(1, MSG.scanRequired)
    .max(SHIPPING_LIMITS.scanCodeMax, MSG.scanTooLong)
    .regex(PRINTABLE_ASCII, MSG.scanNotAscii)
    .transform((code) => code.toUpperCase()),
});

/**
 * Xác nhận bàn giao: biên bản giấy hai bên ký (docs 09 §4 bước 4) — hệ thống ghi tên đại diện hãng
 * và xác nhận đã ký; không có chữ ký số.
 */
export const handoverInputSchema = z.object({
  carrierRepresentative: z
    .string()
    .trim()
    .min(1, MSG.carrierRepresentativeRequired)
    .max(SHIPPING_LIMITS.carrierRepresentativeMax, MSG.tooLong),
  note: z.string().trim().max(SHIPPING_LIMITS.noteMax, MSG.tooLong).default(""),
  signed: z.literal(true, { message: MSG.signedRequired }),
});
