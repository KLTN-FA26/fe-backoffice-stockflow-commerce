/**
 * Số liệu seed chung của mock đóng gói chuyển kho và mock kế hoạch xếp xe (BE PR #164): lệnh `TO-2026-0006` (mock-data,
 * PICKING, nguyên chuyến) đã đóng gói xong với hai kiện niêm phong — nên vừa có phiên `PACKED` vừa là ứng viên của một
 * kế hoạch xe nguồn TRANSFER. Hai nơi cùng đọc file này để số kiện, mã nhãn và số đo không lệch nhau.
 */

export const SEED_PACKED_TRANSFER_ID = "TO-2026-0006";
export const SEED_PACKED_TRANSFER_NUMBER = "TO-2026-0006";
export const SEED_PACKED_TRANSFER_PACK_ID = "00000000-0000-4000-8000-0000000fb006";
export const SEED_PACKED_TRANSFER_PACKED_AT = "2026-10-22T04:00:00Z";
export const SEED_PACKED_TRANSFER_FROM = "WH-HN-01";
export const SEED_PACKED_TRANSFER_TO = "WH-DN-01";

/** Kiện của lệnh seed đã đóng: mỗi kiện 40 đơn vị SKU-001-BLK-L (80 = SL yêu cầu của `TOL-0006-1`). */
export const SEED_PACKED_TRANSFER_PARCELS = [
  { n: 1, sku: "SKU-001-BLK-L", units: 40, kg: 18.5, lengthCm: 60, widthCm: 40, heightCm: 35 },
  { n: 2, sku: "SKU-001-BLK-L", units: 40, kg: 18.5, lengthCm: 60, widthCm: 40, heightCm: 35 },
] as const;

export const SEED_PACKED_TRANSFER_LINE_ID = "TOL-0006-1";

/** Hàng có sẵn thùng tồn kho chưa mở (LPN) để thử giao nguyên thùng — mock không có sổ thùng thật. */
export const MOCK_STOCK_CARTONS: Record<
  string,
  {
    stockPackageId: string;
    sku: string;
    lotNumber: string | null;
    units: number;
    unitOfMeasure: string;
    suggested: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number } | null;
    /** Thùng đã mở / đang giữ: giao nguyên không được (409 STOCK_CARTON_NOT_SHIPPABLE). */
    shippable: boolean;
  }
> = {
  "LPN-0001": {
    stockPackageId: "00000000-0000-4000-8000-0000000fc001",
    sku: "SKU-001-BLK-L",
    lotNumber: "LOT-2610-A",
    units: 10,
    unitOfMeasure: "CARTON",
    suggested: { weightKg: 6.2, lengthCm: 40, widthCm: 30, heightCm: 25 },
    shippable: true,
  },
  "LPN-0002": {
    stockPackageId: "00000000-0000-4000-8000-0000000fc002",
    sku: "SKU-001-BLK-L",
    lotNumber: "LOT-2610-B",
    units: 10,
    unitOfMeasure: "CARTON",
    suggested: null,
    shippable: true,
  },
  "LPN-0003": {
    stockPackageId: "00000000-0000-4000-8000-0000000fc003",
    sku: "SKU-001-BLK-L",
    lotNumber: "LOT-2610-A",
    units: 5,
    unitOfMeasure: "CARTON",
    suggested: { weightKg: 3.1, lengthCm: 40, widthCm: 30, heightCm: 25 },
    shippable: false,
  },
};

/** Số thùng mà MỘT đơn vị của hàng đi theo danh mục (> 1 = đóng bộ, LP2-5). */
export const MOCK_BOXES_PER_UNIT: Record<string, number> = { "SKU-KIT-DESK": 2 };

/** Mã vạch giả theo SKU. */
export const mockBarcodeOf = (sku: string): string => `BC-${sku}`;
