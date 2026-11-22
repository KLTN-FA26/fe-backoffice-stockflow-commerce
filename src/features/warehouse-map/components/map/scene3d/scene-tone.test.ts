import { describe, expect, it } from "vitest";

import { neutralToneMap, toneCompensated } from "./scene-tone";

describe("bù tone mapping cho màu nền cảnh có AO", () => {
  it("màu tối / trung bình: bù xong tone mapping ra đúng màu muốn", () => {
    const target: [number, number, number] = [0.02, 0.025, 0.03];
    const out = neutralToneMap(toneCompensated(target));
    out.forEach((c, i) => expect(c).toBeCloseTo(target[i] ?? 0, 3));
  });

  it("nền rất sáng: đầu vào không vượt 1 (giữ bóng đổ trên sàn), kết quả vẫn sáng hơn khi không bù", () => {
    const target: [number, number, number] = [0.93, 0.94, 0.955];
    const input = toneCompensated(target);
    for (const c of input) expect(c).toBeLessThanOrEqual(1);
    const [withComp] = neutralToneMap(input);
    const [without] = neutralToneMap(target);
    expect(withComp).toBeGreaterThan(without ?? 0);
  });
});
