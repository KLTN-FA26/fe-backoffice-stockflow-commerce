import { describe, expect, it } from "vitest";

import { apiVehicleType } from "./__fixtures__/vehicle-type";
import {
  formatInnerSizeMetres,
  formatInnerSizeMm,
  formatMetres,
  formatPayload,
  isValidDimensionMm,
  formatVolume,
  volumeM3,
} from "./selectors";

describe("hiển thị kích thước và thể tích", () => {
  it("mm → m (3 số lẻ), kích thước hiện mét, mm ở tooltip", () => {
    expect(formatMetres(5898)).toBe("5,898");
    expect(formatInnerSizeMetres(apiVehicleType())).toBe("5,898 × 2,352 × 2,393 m");
    expect(formatInnerSizeMm(apiVehicleType())).toBe("5.898 × 2.352 × 2.393 mm");
  });

  it("thể tích m³ = D × R × C / 1e9 (20DC ≈ 33,20 m³)", () => {
    const volume = volumeM3(5898, 2352, 2393);
    expect(volume).toBeCloseTo(33.197, 2);
    expect(formatVolume(volume ?? 0)).toBe("33,20 m³");
    expect(volumeM3(1000, 1000, 1000)).toBe(1);
  });

  it("thiếu hoặc không hợp lệ → null (chưa đủ để xem trước)", () => {
    expect(volumeM3(undefined, 1000, 1000)).toBeNull();
    expect(volumeM3(1000, 0, 1000)).toBeNull();
    expect(volumeM3(1000, 1000, -5)).toBeNull();
    expect(volumeM3(Number.NaN, 1, 1)).toBeNull();
  });

  it("ngoài giới hạn BE (1..30.000 mm, số nguyên) → null, không hiện thể tích vô nghĩa", () => {
    // Cả ba cạnh quá lớn từng cho ra "20.166.048.604.820,16 m³"
    expect(volumeM3(2_716_000_000, 2_352_000_000, 3_157_000_000)).toBeNull();
    expect(volumeM3(30_001, 2352, 2393)).toBeNull();
    expect(volumeM3(5898.5, 2352, 2393)).toBeNull();
    expect(volumeM3(30_000, 30_000, 30_000)).toBe(27_000);
    expect(isValidDimensionMm(1)).toBe(true);
    expect(isValidDimensionMm(0)).toBe(false);
  });

  it("tải trọng kèm đơn vị", () => {
    expect(formatPayload(28200)).toBe("28.200 kg");
    expect(formatPayload(1250.5)).toBe("1.250,5 kg");
  });
});
