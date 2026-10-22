/**
 * Cân bằng bộ (kit): mỗi bộ phải lên MỖI xe với số lượng các thành phần theo đúng tỉ lệ của bộ, để
 * mặt bàn và chân bàn không rơi vào hai xe khác nhau (design §1 "Kits"). (Gốc: `balanceOk` trong
 * `kit-packing.tsx`.)
 *
 * Bản gốc chỉ so các thành phần bằng nhau; bộ thật có số thành phần khác nhau (1 mặt + 4 chân) nên
 * ở đây mỗi thành phần khai báo `perSet` và số bộ = số kiện ÷ perSet phải là một số nguyên giống
 * nhau ở mọi thành phần của bộ trong xe đó.
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
  /** Số bộ trọn vẹn trong xe; null nếu lệch. */
  sets: number | null;
  /** Số kiện đã xếp theo từng thành phần. */
  counts: Readonly<Record<string, number>>;
  /** Có kiện thuộc bộ này nhưng tên thành phần không nằm trong định nghĩa bộ. */
  unknownParts: readonly string[];
}

export interface KitBalance {
  /** Mọi (xe, bộ) đều cân; true khi không có bộ nào. */
  ok: boolean;
  vehicles: VehicleKitBalance[];
}

function balanceOf(layout: Layout, kit: KitDef): VehicleKitBalance {
  const known = new Set(kit.parts.map((p) => p.partName));
  const counts: Record<string, number> = Object.fromEntries(kit.parts.map((p) => [p.partName, 0]));
  const unknown = new Set<string>();
  for (const box of layout.boxes) {
    if (box.kitGroup !== kit.group) continue;
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
  };
}

export function computeKitBalance(layouts: readonly Layout[], kits: readonly KitDef[]): KitBalance {
  const vehicles = layouts.flatMap((layout) => kits.map((kit) => balanceOf(layout, kit)));
  return { ok: vehicles.every((v) => v.sets !== null), vehicles };
}
