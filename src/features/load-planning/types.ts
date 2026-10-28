/** Kiểu của hợp đồng `Layout` — suy ra từ zod, không khai báo tay (`schemas.ts`). */

import type { z } from "zod";

import type {
  BlockMmSchema,
  DimsMmSchema,
  LayoutBoxSchema,
  LayoutSchema,
  UnplacedLineSchema,
} from "./schemas";

export type BlockMm = z.infer<typeof BlockMmSchema>;
export type DimsMm = z.infer<typeof DimsMmSchema>;
export type LayoutBox = z.infer<typeof LayoutBoxSchema>;
export type Layout = z.infer<typeof LayoutSchema>;

/** Kích thước ba trục (mm) của một vùng chứa: rộng (x), cao (y), dài (z). */
export type ExtentMm = Pick<BlockMm, "wMm" | "hMm" | "dMm">;

/** Dòng hàng chưa xếp được: chỉ cần số lượng + khoá nhận dạng để so với kiện đã xếp. */
export type UnplacedLine = z.infer<typeof UnplacedLineSchema>;

/** Cửa xe (mm) theo loại xe (LP3-DOOR): ô nào `null` là không giới hạn chiều đó. */
export interface DoorMm {
  widthMm: number | null;
  heightMm: number | null;
}
