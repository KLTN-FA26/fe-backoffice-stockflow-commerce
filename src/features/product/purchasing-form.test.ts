import { describe, expect, it } from "vitest";

import { SKU_PURCHASING_FIELD_MESSAGES as M } from "@/constants";

import { toSkuPurchasingRequest } from "./purchasing-api";
import {
  formToPurchasingValues,
  NO_DEFAULT_SUPPLIER,
  purchasingFormSchema,
  purchasingToForm,
} from "./purchasing-form";
import { beSkuPurchasingSchema, skuPurchasingInputSchema } from "./purchasing-schemas";

import type { PurchasingFormValues } from "./purchasing-form";

const SUPPLIER = "33333333-3333-4333-8333-333333333333";

const form = (over: Partial<PurchasingFormValues> = {}): PurchasingFormValues => ({
  defaultSupplierId: SUPPLIER,
  referencePurchasePrice: "150000",
  referencePurchaseCurrency: "VND",
  leadTimeDays: "5",
  moq: "10",
  ...over,
});

/** Lỗi của ô giá sau khi form kiểm (đúng đường `zodResolver(purchasingFormSchema)` của editor). */
function priceErrors(price: string): string[] {
  const parsed = purchasingFormSchema.safeParse(form({ referencePurchasePrice: price }));
  if (parsed.success) return [];
  return parsed.error.issues
    .filter((issue) => issue.path[0] === "referencePurchasePrice")
    .map((issue) => issue.message);
}

/** Form hợp lệ → body PUT thật (form → values → schema Input Step 2A → serializer Step 2A). */
function requestBody(values: PurchasingFormValues, version = 7) {
  expect(purchasingFormSchema.safeParse(values).success).toBe(true);
  return toSkuPurchasingRequest(
    version,
    skuPurchasingInputSchema.parse(formToPurchasingValues(values)),
  );
}

describe("ô giá mua tham khảo — nhập mơ hồ bị chặn, không đổi ngầm (P2-5)", () => {
  it.each([
    ["150.000", "150000"],
    ["150,000", "150000"],
    ["95.000", "95000"],
    ["95,000", "95000"],
    ["1.005", "1005"],
  ])("A1–A4 %s → lỗi ở ô giá, gợi ý nhập %s, không thành giá nhỏ hơn", (price, digits) => {
    expect(priceErrors(price)).toEqual([M.referencePurchasePriceGrouped(digits)]);
  });

  it.each([
    ["1.500.000", "1500000"],
    ["1,500,000", "1500000"],
    ["1.500,000", "1500000"],
    ["1 500 000", "1500000"],
    ["1 500 000", "1500000"],
  ])("A5 nhiều dấu phân cách hàng nghìn %s → chặn, gợi ý %s", (price, digits) => {
    expect(priceErrors(price)).toEqual([M.referencePurchasePriceGrouped(digits)]);
  });

  it("A5 nhiều dấu chấm kèm phần lẻ → chặn, không đoán phần nào là thập phân", () => {
    expect(priceErrors("1.500.000.50")).toEqual([M.referencePurchasePriceGrouped(null)]);
  });

  it("A5 khoảng trắng kèm phần thập phân → gợi ý giữ nguyên dấu chấm thập phân", () => {
    expect(priceErrors("1 500.5")).toEqual([M.referencePurchasePriceGrouped("1500.5")]);
  });

  it.each(["12,5", "12,50", "1.500,50"])(
    "dấu phẩy %s không bao giờ được đổi thành dấu chấm",
    (price) => {
      expect(priceErrors(price)).toEqual([M.referencePurchasePriceComma]);
    },
  );

  it.each(["150.0000", "1.2345", "12.500"])(
    "%s: quá 2 chữ số thập phân trên chuỗi GỐC → chặn (không bỏ 0 cuối trước khi kiểm)",
    (price) => {
      expect(priceErrors(price)).toHaveLength(1);
    },
  );

  it("formToPurchasingValues giữ nguyên chuỗi người nhập — dấu phẩy để schema BE chặn, không tự đổi", () => {
    expect(
      formToPurchasingValues(form({ referencePurchasePrice: " 150,000 " })).referencePurchasePrice,
    ).toBe("150,000");
    expect(
      skuPurchasingInputSchema.safeParse(
        formToPurchasingValues(form({ referencePurchasePrice: "150,000" })),
      ).success,
    ).toBe(false);
  });
});

describe("ô giá mua tham khảo — giá trị hợp lệ", () => {
  it("B6 150000 → gửi số 150000", () => {
    expect(requestBody(form()).referencePurchasePrice).toBe(150000);
  });

  it("B7 trống cả giá lẫn tiền tệ → null tường minh", () => {
    const body = requestBody(form({ referencePurchasePrice: "  ", referencePurchaseCurrency: "" }));
    expect(body.referencePurchasePrice).toBeNull();
    expect(body.referencePurchaseCurrency).toBeNull();
  });

  it("B8 giá 0 → chặn theo BE `@Positive` (0 không phải 'chưa có giá')", () => {
    expect(priceErrors("0")).toEqual([M.referencePurchasePrice]);
    expect(priceErrors("0.00")).toEqual([M.referencePurchasePrice]);
  });

  it.each([
    ["12.5", 12.5],
    ["12.50", 12.5],
    ["0.01", 0.01],
    ["150000.00", 150000],
    ["12345678901234.56", 12345678901234.56],
  ])("B9 phần thập phân bằng dấu chấm, tối đa 2 chữ số: %s → %s", (price, sent) => {
    expect(priceErrors(price)).toEqual([]);
    expect(
      requestBody(form({ referencePurchasePrice: price, referencePurchaseCurrency: "USD" }))
        .referencePurchasePrice,
    ).toBe(sent);
  });

  it("B9 giá quá nhiều chữ số để JSON chở nguyên vẹn vẫn bị chặn như trước", () => {
    expect(priceErrors("9999999999999999.99")).toEqual([M.referencePurchasePricePrecision]);
  });

  it("B10 cặp giá + tiền tệ: thiếu tiền tệ báo ở ô tiền tệ; có cả hai thì gửi đủ", () => {
    const parsed = purchasingFormSchema.safeParse(form({ referencePurchaseCurrency: "" }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ["referencePurchaseCurrency"], message: M.pricePairing }),
    ]);
    expect(requestBody(form({ referencePurchaseCurrency: "vnd" }))).toMatchObject({
      referencePurchasePrice: 150000,
      referencePurchaseCurrency: "VND",
    });
  });

  it("giá mơ hồ không che lỗi thiếu tiền tệ ở ô kia", () => {
    const parsed = purchasingFormSchema.safeParse(
      form({ referencePurchasePrice: "150.000", referencePurchaseCurrency: "" }),
    );
    expect(parsed.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["referencePurchasePrice", M.referencePurchasePriceGrouped("150000")],
      ["referencePurchaseCurrency", M.pricePairing],
    ]);
  });
});

describe("giá trị server nạp vào form vẫn hợp lệ", () => {
  it.each([
    [150000, "150000"],
    ["150000.00", "150000"],
    [12.5, "12.5"],
    [1000.05, "1000.05"],
  ])("BE %s → ô giá %s, lưu lại không đổi", (price, shown) => {
    const server = beSkuPurchasingSchema.parse({
      variantId: "v-1",
      sku: "CUP-A",
      version: 3,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: price,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 0,
    });
    const values = purchasingToForm(server);
    expect(values.referencePurchasePrice).toBe(shown);
    expect(requestBody(values, server.version)).toEqual({
      version: 3,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: Number(shown),
      referencePurchaseCurrency: "VND",
      leadTimeDays: 0,
      moq: null,
    });
  });

  it("không có NCC mặc định → null, các ô khác giữ nguyên trong PUT thay toàn bộ", () => {
    expect(requestBody(form({ defaultSupplierId: NO_DEFAULT_SUPPLIER }))).toEqual({
      version: 7,
      defaultSupplierId: null,
      referencePurchasePrice: 150000,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 5,
      moq: 10,
    });
  });
});
