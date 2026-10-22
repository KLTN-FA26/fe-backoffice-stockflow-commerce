/**
 * Hợp đồng `Layout` của kế hoạch xếp xe (design v2 §5) — kế hoạch xếp xe và ước lượng dùng chung.
 *
 * Hệ trục (cố định, mọi đơn vị là mm): x = chiều rộng xe, y = hướng lên, z = chiều dài xe hướng về
 * phía cửa. Gốc toạ độ là góc sàn bên trong, sát vách đầu xe (vách đối diện cửa). Mỗi khối
 * (`xMm,yMm,zMm`) là góc nhỏ nhất của khối; `wMm` dọc x, `hMm` dọc y, `dMm` dọc z.
 *
 * Đây là hợp đồng FE đề xuất cho BE PR D — tên trường dưới đây là tên BE cần trả về.
 */

import { z } from "zod";

import { LAYOUT_ORIENTATIONS } from "@/constants";

const nonNegative = z.number().nonnegative();
const positive = z.number().positive();

/** Khối hình hộp trong xe: góc nhỏ nhất + kích thước theo ba trục. */
export const BlockMmSchema = z.object({
  xMm: nonNegative,
  yMm: nonNegative,
  zMm: nonNegative,
  wMm: positive,
  hMm: positive,
  dMm: positive,
});

/** Kích thước danh định (dài × rộng × cao) theo thứ tự trên phiếu: l = dài, w = rộng, h = cao. */
export const DimsMmSchema = z.object({ l: positive, w: positive, h: positive });

export const LayoutBoxSchema = BlockMmSchema.extend({
  /** Mã dòng/kiện nguồn do BE truyền xuyên qua solver; KHÔNG bắt buộc duy nhất giữa các kiện. */
  ref: z.string().min(1),
  /** Mã ngắn in trên mặt kiện (thường là SKU). */
  label: z.string(),
  /** Tên mặt hàng/chi tiết — khoá chọn màu và nhóm dòng trong bảng. */
  partName: z.string(),
  /** Mã bộ (kit) mà kiện thuộc về; vắng hoặc null nếu không thuộc bộ nào. */
  kitGroup: z.string().min(1).nullable().default(null),
  /** Kích thước danh định trước khi xoay. */
  origMm: DimsMmSchema,
  /** Hướng đặt: xem `LAYOUT_ORIENTATIONS`. `wMm/hMm/dMm` phải khớp `origMm` theo hướng này. */
  orientation: z.enum(LAYOUT_ORIENTATIONS),
  weightKg: nonNegative,
});

export const LayoutSchema = z.object({
  /** Số thứ tự xe trong kế hoạch, bắt đầu từ 1. */
  seq: z.number().int().positive(),
  /** Mã loại xe (vd `40HC`, `PICKUP-1T`). */
  code: z.string().min(1),
  /** Lòng xe: l = dài (trục z), w = rộng (trục x), h = cao (trục y). */
  innerMm: DimsMmSchema,
  maxPayloadKg: nonNegative,
  /** Khối gia cố ở góc trên (không xếp hàng vào), cùng hệ toạ độ với `boxes`. */
  gussets: z.array(BlockMmSchema),
  boxes: z.array(LayoutBoxSchema),
  usedVolumeMm3: nonNegative,
  usedWeightKg: nonNegative,
});
