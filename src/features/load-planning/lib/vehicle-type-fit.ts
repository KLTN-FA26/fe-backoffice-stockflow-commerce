/**
 * Loại xe trong ô chọn của kế hoạch xếp xe — tên người đọc được, kích thước và thứ tự gợi ý (hàm thuần, chỉ để hiển thị
 * và sắp xếp; BE vẫn quyết định xe nào dùng được — BR-12).
 */

import { VEHICLE_TYPE_LIMITS } from "@/constants";
import { formatDecimal } from "@/lib/format/number";

/** Phần của loại xe mà các hàm ở đây cần. */
export interface FitVehicleType {
  vehicleTypeId: string;
  code: string;
  name: string;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  maxPayloadKg: number;
}

/** Tải của các lô đang chọn (khối lượng kg, thể tích mm³). */
export interface PlanLoad {
  weightKg: number;
  volumeMm3: number;
}

/** Lòng xe dài × rộng × cao bằng mét, một số lẻ: "3,1 × 1,6 × 1,6". */
export function vehicleTypeSize(type: FitVehicleType): string {
  return [type.innerLengthMm, type.innerWidthMm, type.innerHeightMm]
    .map((mm) => formatDecimal(mm / VEHICLE_TYPE_LIMITS.mmPerMetre, 1))
    .join(" × ");
}

const volumeOf = (type: FitVehicleType) =>
  type.innerLengthMm * type.innerWidthMm * type.innerHeightMm;

/** Tải này nằm gọn trong MỘT xe loại này (khối lượng và thể tích; chưa xét cách xếp từng kiện). */
export function fitsInOne(type: FitVehicleType, load: PlanLoad): boolean {
  return load.weightKg <= type.maxPayloadKg && load.volumeMm3 <= volumeOf(type);
}

export interface OrderedVehicleTypes<T> {
  /** Loại ước tính đã dùng, rồi loại chở được cả tải trong một xe — mỗi nhóm theo lòng xe nhỏ trước. */
  fitting: T[];
  /** Loại còn lại (một xe không chở hết, phải dùng nhiều xe), theo lòng xe tăng dần. */
  others: T[];
}

/** Nhỏ trước: thể tích lòng xe, rồi tải trọng, rồi mã (ổn định). */
const bySize = (a: FitVehicleType, b: FitVehicleType) =>
  volumeOf(a) - volumeOf(b) || a.maxPayloadKg - b.maxPayloadKg || a.code.localeCompare(b.code);

/**
 * Xếp loại xe: trước hết loại mà ước tính tải của các đơn đã chọn dùng (dù không phải loại nhỏ nhất), rồi loại chở được cả
 * tải trong một xe; mỗi nhóm theo thể tích lòng xe tăng dần rồi tải trọng, nên container của tải 95 kg nằm cuối nhóm vừa.
 * Loại còn lại (phải dùng nhiều xe) theo sau. Chưa chọn lô nào (tải 0) và chưa có ước tính thì không có căn cứ để gom: mọi
 * loại theo lòng xe tăng dần.
 */
export function orderVehicleTypes<T extends FitVehicleType>(
  types: readonly T[],
  load: PlanLoad,
  estimatedCodes: ReadonlySet<string> = new Set(),
): OrderedVehicleTypes<T> {
  const sorted = [...types].sort(bySize);
  const noLoad = load.weightKg <= 0 && load.volumeMm3 <= 0;
  const estimated = sorted.filter((type) => estimatedCodes.has(type.code));
  const fits = sorted.filter(
    (type) => !estimatedCodes.has(type.code) && !noLoad && fitsInOne(type, load),
  );
  if (estimated.length === 0 && fits.length === 0) return { fitting: sorted, others: [] };
  const listed = new Set([...estimated, ...fits]);
  return {
    fitting: [...estimated, ...fits],
    others: sorted.filter((type) => !listed.has(type)),
  };
}
