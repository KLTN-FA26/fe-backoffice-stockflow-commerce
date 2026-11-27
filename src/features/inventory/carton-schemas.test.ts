import { describe, expect, it } from "vitest";

import { cartonDetailDto, cartonListInput, cartonRowDto } from "./carton-schemas";

const ROW = {
  lpn: "LPN-20261111-000001",
  sku: "CUP-PP-500",
  unitOfMeasure: "CARTON",
  nominalQty: 1,
  countedAt: "2026-11-11T00:00:00Z",
  lotNumber: null,
  onHand: 1,
  reserved: 0,
  status: "IN_STOCK",
  locationCode: "HCM-A01-2-B",
  goodsReceiptLineId: null,
  openedOnReturn: false,
  warehouseId: "0e380000-0000-4000-8000-000000000001",
  warehouseCode: "HCM",
  productName: "Ly nhựa PP",
  variantName: "Ly nhựa PP 500 ml",
  stockStatuses: ["AVAILABLE"],
  receivedAt: "2026-11-11T13:19:35.225Z",
  goodsReceiptId: null,
  goodsReceiptNumber: null,
  source: "IN_WAREHOUSE",
  heldFor: [{ orderId: "0e380000-0000-4000-8000-000000000002", orderNumber: "SO-1", quantity: 1 }],
  openTask: { type: "PICK", id: "0e380000-0000-4000-8000-000000000003", number: null },
};

describe("cartonRowDto — BE StockPackageResponse (#454)", () => {
  it("đọc đủ các field mới: kho, sản phẩm, trạng thái tồn, nguồn, đơn giữ, việc đang làm", () => {
    const row = cartonRowDto.parse(ROW);
    expect(row).toMatchObject({
      warehouseCode: "HCM",
      productName: "Ly nhựa PP",
      stockStatuses: ["AVAILABLE"],
      source: "IN_WAREHOUSE",
      openTask: { type: "PICK" },
    });
    expect(row.heldFor).toHaveLength(1);
  });

  it("BE cũ thiếu các field mới → vẫn parse, mảng rỗng, không vỡ màn", () => {
    const legacy = Object.fromEntries(
      Object.entries(ROW).filter(
        ([key]) =>
          !["warehouseId", "warehouseCode", "productName", "variantName", "stockStatuses"].includes(
            key,
          ) && !["receivedAt", "source", "heldFor", "openTask"].includes(key),
      ),
    );
    const row = cartonRowDto.parse(legacy);
    expect(row.stockStatuses).toEqual([]);
    expect(row.heldFor).toEqual([]);
    expect(row.openTask).toBeNull();
  });

  it("nguồn / loại việc / trạng thái tồn lạ đọc nguyên văn (chuỗi mở)", () => {
    const row = cartonRowDto.parse({
      ...ROW,
      source: "NEW_SOURCE",
      stockStatuses: ["SOMETHING"],
      openTask: { type: "NEW_TASK", id: ROW.openTask.id },
    });
    expect(row.source).toBe("NEW_SOURCE");
    expect(row.openTask?.type).toBe("NEW_TASK");
  });

  it("chi tiết thùng có thêm nội dung theo dòng tồn", () => {
    const detail = cartonDetailDto.parse({
      ...ROW,
      closedAt: null,
      contents: [
        {
          lotNumber: null,
          receivedAt: ROW.receivedAt,
          status: "AVAILABLE",
          onHand: 1,
          reserved: 0,
        },
      ],
    });
    expect(detail.contents).toHaveLength(1);
    expect(detail.variantName).toBe("Ly nhựa PP 500 ml");
  });
});

describe("cartonListInput — tham số GET /inventory/stock-packages", () => {
  it("bỏ trống thì không gửi; mã SKU / vị trí / lô viết hoa, bỏ khoảng trắng (BE so đúng mã)", () => {
    expect(
      cartonListInput.parse({
        page: 0,
        size: 25,
        q: "",
        sku: " cup-pp-500 ",
        location: "hcm-a01-2-b",
        lotNumber: " lot-2026-03",
      }),
    ).toEqual({
      page: 0,
      size: 25,
      sku: "CUP-PP-500",
      location: "HCM-A01-2-B",
      lotNumber: "LOT-2026-03",
    });
  });

  it("q dưới 3 ký tự không gửi (BE trả 400); đủ 3 thì gửi", () => {
    expect(cartonListInput.parse({ page: 0, size: 25, q: "00" }).q).toBeUndefined();
    expect(cartonListInput.parse({ page: 0, size: 25, q: " 001 " }).q).toBe("001");
  });

  it("trạng thái lặp lại giữ dạng mảng; sort FIFO thành receivedAt,asc", () => {
    expect(
      cartonListInput.parse({
        page: 1,
        size: 50,
        stockStatus: ["QUARANTINE", "DAMAGED"],
        status: ["IN_STOCK"],
        sort: "receivedAt",
      }),
    ).toMatchObject({
      stockStatus: ["QUARANTINE", "DAMAGED"],
      status: ["IN_STOCK"],
      sort: "receivedAt,asc",
    });
  });

  it("sort đảo chiều được: receivedAt + desc → receivedAt,desc", () => {
    expect(
      cartonListInput.parse({ page: 0, size: 25, sort: "receivedAt", direction: "desc" }).sort,
    ).toBe("receivedAt,desc");
  });

  it("cỡ trang vượt 200 (Pages.MAX_PAGE_SIZE) bị từ chối", () => {
    expect(() => cartonListInput.parse({ page: 0, size: 500 })).toThrow();
  });
});
