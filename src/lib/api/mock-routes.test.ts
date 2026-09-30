import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createProduct,
  getProduct,
  publishProduct,
  transitionProduct,
  unpublishProduct,
  updateProduct,
} from "@/features/product/api";
import { api } from "@/lib/api/client";

import { activateMockAdapter } from "./mock-adapter";

const originalAdapter = api.defaults.adapter;
let categoryId: string;

beforeAll(async () => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();

  const response = await api.get<{ items: Array<{ categoryId: string }> }>("/categories");
  categoryId = response.data.items[0]?.categoryId ?? "";
  expect(categoryId).not.toBe("");
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("product mock logistics round-trip", () => {
  it("returns all logistics fields from GET after create", async () => {
    const created = await createProduct({
      code: `MOCK-LOG-CREATE-${Date.now()}`,
      name: "Mock logistics create",
      nameEn: "Mock logistics create",
      categoryId,
      description: "",
      descriptionEn: "",
      brand: "StockFlow",
      taxClass: "STANDARD",
      customizable: false,
      images: [],
      weightKg: 1.25,
      lengthCm: 31.5,
      widthCm: 22.25,
      heightCm: 9.75,
    });

    const loaded = await getProduct(created.productId);

    expect(loaded).toMatchObject({
      weightKg: 1.25,
      lengthCm: 31.5,
      widthCm: 22.25,
      heightCm: 9.75,
    });
  });

  it("returns updated logistics fields from GET after update", async () => {
    const created = await createProduct({
      code: `MOCK-LOG-UPDATE-${Date.now()}`,
      name: "Mock logistics before update",
      nameEn: "Mock logistics before update",
      categoryId,
      description: "",
      descriptionEn: "",
      brand: "StockFlow",
      taxClass: "STANDARD",
      customizable: false,
      images: [],
      weightKg: 1,
      lengthCm: 2,
      widthCm: 3,
      heightCm: 4,
    });

    await updateProduct({
      id: created.productId,
      name: "Mock logistics after update",
      nameEn: "Mock logistics after update",
      categoryId,
      description: "",
      descriptionEn: "",
      brand: "StockFlow",
      taxClass: "STANDARD",
      customizable: false,
      images: [],
      weightKg: 4.5,
      lengthCm: 40.25,
      widthCm: 30.75,
      heightCm: 20.5,
    });

    const loaded = await getProduct(created.productId);

    expect(loaded).toMatchObject({
      weightKg: 4.5,
      lengthCm: 40.25,
      widthCm: 30.75,
      heightCm: 20.5,
    });
  });
});

describe("product mock lifecycle contract", () => {
  it("mirrors data-returning and void backend transitions", async () => {
    const created = await createProduct({
      code: `MOCK-LIFECYCLE-${Date.now()}`,
      name: "Mock lifecycle",
      nameEn: "Mock lifecycle",
      categoryId,
      description: "",
      descriptionEn: "",
      brand: "StockFlow",
      taxClass: "STANDARD",
      customizable: false,
      images: [],
      weightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
    });

    const submitted = await transitionProduct({ id: created.productId, action: "submit" });
    expect(submitted.status).toBe("Pending Approval");
    expect(submitted.submittedBy).toBeTruthy();

    const approved = await transitionProduct({ id: created.productId, action: "approve" });
    expect(approved.status).toBe("Approved");
    await expect(publishProduct(created.productId)).resolves.toBeUndefined();
    expect((await getProduct(created.productId)).status).toBe("Published");
    await expect(unpublishProduct(created.productId)).resolves.toBeUndefined();
    expect((await getProduct(created.productId)).status).toBe("Approved");
  });
});
