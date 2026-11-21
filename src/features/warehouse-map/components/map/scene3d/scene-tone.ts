/**
 * Màu nền cảnh khi có hậu kỳ (AO): qua `EffectComposer`, tone mapping áp cả lên màu nền (render thẳng ra màn hình
 * thì không) nên nền xám đi so với khung trang. Đảo ngược Khronos PBR Neutral để nền ra gần đúng token. Thuần.
 *
 * Chặn đầu vào ở 1: đẩy nền vượt 1 thì vùng trắng bị nén mạnh, bóng đổ trên sàn (shadow catcher trong suốt, hoà
 * lên nền) gần như biến mất — đổi lại nền rất sáng chỉ còn gần đúng.
 */

/** Phơi sáng của cảnh (MapScene3D) — sàn trắng không loá, màu sơn rõ. */
export const SCENE_EXPOSURE = 0.85;

type Rgb = [number, number, number];

/** Khronos PBR Neutral (như `NeutralToneMapping` của three), trên RGB tuyến tính đã nhân phơi sáng. */
export function neutralToneMap([r0, g0, b0]: Rgb, exposure = SCENE_EXPOSURE): Rgb {
  let [r, g, b] = [r0 * exposure, g0 * exposure, b0 * exposure];
  const x = Math.min(r, g, b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  [r, g, b] = [r - offset, g - offset, b - offset];
  const start = 0.8 - 0.04;
  const peak = Math.max(r, g, b);
  if (peak < start) return [r, g, b];
  const d = 1 - start;
  const next = 1 - (d * d) / (peak + d - start);
  const k = next / peak;
  [r, g, b] = [r * k, g * k, b * k];
  const t = 1 - 1 / (0.15 * (peak - next) + 1);
  return [r + (next - r) * t, g + (next - g) * t, b + (next - b) * t];
}

/** RGB tuyến tính đầu vào sao cho sau tone mapping gần `target` nhất (mỗi kênh trong 0…1). */
export function toneCompensated(target: Rgb, exposure = SCENE_EXPOSURE): Rgb {
  let value: Rgb = [...target];
  for (let i = 0; i < 60; i += 1) {
    const got = neutralToneMap(value, exposure);
    value = value.map((c, j) =>
      Math.min(1, Math.max(0, c + (target[j] ?? 0) - (got[j] ?? 0))),
    ) as Rgb;
  }
  return value;
}
