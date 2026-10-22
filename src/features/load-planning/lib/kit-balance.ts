/**
 * Cân bằng bộ (kit): mỗi bộ phải lên MỖI xe với số lượng các thành phần theo đúng tỉ lệ của bộ, để
 * mặt bàn và chân bàn không rơi vào hai xe khác nhau (design §1 "Kits"). (Gốc: `balanceOk` trong
 * `kit-packing.tsx`.)
 *
 * Bản gốc chỉ so các thành phần bằng nhau; bộ thật có số thành phần khác nhau (1 mặt + 4 chân) nên
 * ở đây mỗi thành phần có `perSet` và số bộ = số kiện ÷ perSet phải là một số nguyên giống nhau ở
 * mọi thành phần của bộ trong xe đó.
 *
 * Hợp đồng `Layout` không có `perSet`, nên mặc định bộ được SUY RA từ chính các kiện (`deriveKitDefs`):
 * gom theo `kitGroup`, thành phần theo `partName`, và `perSet` = tổng số kiện của thành phần trong cả
 * kế hoạch chia cho ƯCLN các tổng (bộ nhỏ nhất đủ ghép — 4 mặt + 16 chân → 1 mặt + 4 chân). Có định
 * nghĩa chính thức (vd từ dòng ước lượng `kitParts`) thì truyền vào `kits` để dùng thay thế; khi đó
 * kiện có `kitGroup` không nằm trong định nghĩa nào bị báo là bộ lạ, không bị bỏ qua.
 */

import type { Layout } from "../types";

export interface KitPartDef {
  partName: string;
  /** Số kiện của thành phần này trong MỘT bộ. */
  perSet: number;
}

export interface KitDef {
  group: string;
  parts: readonly KitPartDef[];
}

export interface VehicleKitBalance {
  vehicleSeq: number;
  group: string;
  /** Số bộ trọn vẹn trong xe; null nếu lệch hoặc bộ lạ. */
  sets: number | null;
  /** Số kiện đã xếp theo từng thành phần. */
  counts: Readonly<Record<string, number>>;
  /** Có kiện thuộc bộ này nhưng tên thành phần không nằm trong định nghĩa bộ. */
  unknownParts: readonly string[];
  /** `kitGroup` của kiện không có định nghĩa bộ nào (chỉ khi truyền `kits` tường minh). */
  unknownGroup: boolean;
}

export interface KitBalance {
  /** Mọi (xe, bộ) đều cân; true khi không xe nào có kiện thuộc bộ. */
  ok: boolean;
  /** Chỉ gồm (xe, bộ) mà xe đó THỰC SỰ có kiện của bộ — xe không có bộ nào thì không có mục. */
  vehicles: VehicleKitBalance[];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Suy định nghĩa bộ từ các kiện của cả kế hoạch (xem đầu file). */
export function deriveKitDefs(layouts: readonly Layout[]): KitDef[] {
  const totals = new Map<string, Map<string, number>>();
  for (const box of layouts.flatMap((layout) => layout.boxes)) {
    if (box.kitGroup === null) continue;
    const parts = totals.get(box.kitGroup) ?? new Map<string, number>();
    parts.set(box.partName, (parts.get(box.partName) ?? 0) + 1);
    totals.set(box.kitGroup, parts);
  }
  return [...totals].map(([group, parts]) => {
    const unit = [...parts.values()].reduce(gcd);
    return {
      group,
      parts: [...parts].map(([partName, total]) => ({ partName, perSet: total / unit })),
    };
  });
}

function balanceOf(layout: Layout, kit: KitDef): VehicleKitBalance | null {
  const own = layout.boxes.filter((box) => box.kitGroup === kit.group);
  if (own.length === 0) return null;
  const known = new Set(kit.parts.map((p) => p.partName));
  const counts: Record<string, number> = Object.fromEntries(kit.parts.map((p) => [p.partName, 0]));
  const unknown = new Set<string>();
  for (const box of own) {
    if (known.has(box.partName)) counts[box.partName] += 1;
    else unknown.add(box.partName);
  }
  const setsPerPart = kit.parts.map((p) => (p.perSet > 0 ? counts[p.partName] / p.perSet : NaN));
  const [first] = setsPerPart;
  const balanced =
    unknown.size === 0 && Number.isInteger(first) && setsPerPart.every((sets) => sets === first);
  return {
    vehicleSeq: layout.seq,
    group: kit.group,
    sets: balanced ? first : null,
    counts,
    unknownParts: [...unknown],
    unknownGroup: false,
  };
}

function unknownGroups(layout: Layout, kits: readonly KitDef[]): VehicleKitBalance[] {
  const defined = new Set(kits.map((kit) => kit.group));
  const strays = new Set(
    layout.boxes.flatMap((box) =>
      box.kitGroup !== null && !defined.has(box.kitGroup) ? [box.kitGroup] : [],
    ),
  );
  return [...strays].map((group) => ({
    vehicleSeq: layout.seq,
    group,
    sets: null,
    counts: {},
    unknownParts: [],
    unknownGroup: true,
  }));
}

export function computeKitBalance(
  layouts: readonly Layout[],
  kits: readonly KitDef[] = deriveKitDefs(layouts),
): KitBalance {
  const vehicles = layouts.flatMap((layout) => [
    ...kits.flatMap((kit) => balanceOf(layout, kit) ?? []),
    ...unknownGroups(layout, kits),
  ]);
  return { ok: vehicles.every((v) => v.sets !== null), vehicles };
}
