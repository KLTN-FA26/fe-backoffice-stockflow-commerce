/**
 * Hợp đồng `Layout` của kế hoạch xếp xe (design v2 §5) — kế hoạch xếp xe và ước lượng dùng chung.
 *
 * Hệ trục (cố định, mọi đơn vị là mm): x = chiều rộng xe, y = hướng lên, z = chiều dài xe hướng về
 * phía cửa. Gốc toạ độ là góc sàn bên trong, sát vách đầu xe (vách đối diện cửa). Mỗi khối
 * (`xMm,yMm,zMm`) là góc nhỏ nhất của khối; `wMm` dọc x, `hMm` dọc y, `dMm` dọc z.
 *
 * Đây là hợp đồng FE đề xuất cho BE PR D — tên trường dưới đây là tên BE cần trả về. Luật xếp mà
 * hợp đồng phải đủ dữ liệu để kiểm là BR-10/BR-11 (docs 09-shipping §6): đỡ ≥ 98% đáy, trong lòng
 * thùng, tải trọng từng xe, cờ xoay, chừa góc gia cố, đặt vuông góc.
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
  /**
   * Mã của TỪNG kiện: kiện đã đóng gói = id kiện (package); thùng ước lượng = `<lineId>#<n>`.
   * `PLACEMENT_RULE_VIOLATION [{ref, rule}]` chỉ vào đúng kiện này. Duy nhất theo kế hoạch: schema chỉ
   * kiểm trong TỪNG xe (xem `LayoutSchema`); trùng giữa các xe do `findDuplicateRefs` (lib/layout-check)
   * phát hiện, và BE là nơi bảo đảm.
   */
  ref: z.string().min(1),
  /** Dòng ước lượng sinh ra thùng này (`lineId`); null với kiện đã đóng gói. Gom dòng dùng cái này, không dùng `ref`. */
  sourceRef: z.string().min(1).nullable().default(null),
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
  /**
   * Kiện có được xoay không. BR-10 (docs 09-shipping §6): kiện có cờ xoay được đặt theo 6 hướng,
   * kiện không có cờ giữ nguyên hướng đặt (`LWH`). BE đã có cờ này ở `PackageResponse.rotatable`.
   */
  rotatable: z.boolean(),
  weightKg: nonNegative,
});

/** Dòng hàng solver không xếp được: khoá nhận dạng + kích thước danh định + số lượng còn lại. */
export const UnplacedLineSchema = z.object({
  label: z.string(),
  partName: z.string(),
  origMm: DimsMmSchema,
  quantity: z.number().int().nonnegative(),
});

export const LayoutSchema = z
  .object({
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
  })
  .refine((layout) => new Set(layout.boxes.map((box) => box.ref)).size === layout.boxes.length, {
    message: "Mã kiện (ref) phải duy nhất trong xe",
    path: ["boxes"],
  });
