/**
 * Trang cấu hình in của một biến thể, trên mock adapter: chỉ `/identity/me/permissions` được trả tay để chọn quyền.
 * Biến thể seed có cấu hình in đã lưu (`SEED_PRINT_CONFIG_VARIANT`, with the figures the mock seeds for it).
 */
import { configure, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS as TEMPLATE,
  PRODUCT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import {
  PRINT_CONFIG_PAGE_LABELS,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  findMockProduct,
  resetProductMockStore,
  saveMockProduct,
} from "@/lib/api/mock-product-store";
import { SEED_PRINT_CONFIG_VARIANT } from "@/lib/api/mock-print-config-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { findMockVariant, resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { transitionVariant } from "@/features/product/variant-api";
import { renderApp } from "@/features/product/product-test-utils";

import { VariantPrintConfig } from "./VariantPrintConfig";

// The composer's contract with the section is its props: the spy records them and renders the real section.
const section = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock("@/features/product-design", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/product-design")>();
  return {
    ...actual,
    PrintConfigSection: (props: Parameters<typeof actual.PrintConfigSection>[0]) => {
      section.props.push({ ...props });
      return actual.PrintConfigSection(props);
    },
  };
});

vi.setConfig({ testTimeout: 60_000 });
// The mock adapter answers after 200-500 ms, and the first render of a file is slow.
configure({ asyncUtilTimeout: 45_000 });

const T = PRINT_CONFIG_PAGE_LABELS;
const SEED = SEED_PRINT_CONFIG_VARIANT;
const PRODUCT_VIEW = [PRODUCT_PERMISSIONS.viewPage, PRODUCT_PERMISSIONS.read];
const FULL = [...PRODUCT_VIEW, TEMPLATE.viewPage, TEMPLATE.read, TEMPLATE.create, TEMPLATE.update];
/** An active variant of a customizable product that accepts changes: one that can still be made obsolete. */
const ACTIVE_VARIANT = { productId: "PRD-001", variantId: "SKU-001-BLK-M" };
const NO_CONFIG = "Biến thể này chưa có cấu hình in.";
const READ = [...PRODUCT_VIEW, TEMPLATE.viewPage, TEMPLATE.read];
const passThrough = api.get.bind(api);
/** The file input, a first file or one to replace the saved one: present means the person may choose a file. */
const UPLOAD = /^(Chọn hoặc kéo thả file \.glb|Chọn file \.glb khác để thay)$/;

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  section.props.length = 0;
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

/** Mock products of the seed carry the legacy status "Active"; the BE statuses are what the gate knows. */
async function setStatus(
  productId: string,
  status: "Approved" | "Discontinued" | "Pending Approval",
) {
  const product = await findMockProduct(productId);
  if (!product) throw new Error(`mock product ${productId} missing`);
  saveMockProduct({ ...product, status });
}

function open(
  ids: { productId: string; variantId: string },
  permissions: readonly string[] = FULL,
) {
  vi.spyOn(api, "get").mockImplementation(async (url, config) =>
    url === "/identity/me/permissions"
      ? { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } }
      : passThrough(url, config),
  );
  return renderApp(<VariantPrintConfig {...ids} />);
}

const measured = () => screen.findByRole("table", { name: "Số đo lấy từ file 3D" });

/** The variant's units as the BE lists them: `carton` adds a packing unit of 50 (a carton candidate). */
function withUnits(ids: { productId: string; variantId: string }, carton: boolean) {
  const unit = (id: string, unitOfMeasure: string, factor: number, base: boolean) => ({
    id,
    sku: ids.variantId,
    unitOfMeasure,
    factor,
    base,
    defaultPurchase: base,
    active: true,
    version: 0,
  });
  const items = [
    unit("u-each", "EACH", 1, true),
    ...(carton ? [unit("u-box", "THUNG", 50, false)] : []),
  ];
  const unitsPath = `/products/${ids.productId}/variants/${ids.variantId}/uom-conversions`;
  vi.spyOn(api, "get").mockImplementation(async (url, config) =>
    url === "/identity/me/permissions"
      ? { data: { roles: ["TEST"], permissions: [...FULL], dataScope: "ALL" } }
      : url === unitsPath
        ? { data: { items } }
        : passThrough(url, config),
  );
  return renderApp(<VariantPrintConfig {...ids} />);
}

describe("VariantPrintConfig — quy cách thùng (preflight CARTON_SPEC_MISSING)", () => {
  it("a variant without a packing unit warns that customers cannot submit, with the way to the product", async () => {
    await setStatus(SEED.productId, "Approved");
    withUnits(SEED, false);
    const warning = await screen.findByText(PRINT_CONFIG_PAGE_LABELS.cartonMissing.title);
    expect(warning).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: PRINT_CONFIG_PAGE_LABELS.cartonMissing.link }),
    ).toHaveAttribute("href", ADMIN_ROUTES.products.detail(SEED.productId));
  });

  it("a variant with a carton says nothing about it", async () => {
    await setStatus(SEED.productId, "Approved");
    withUnits(SEED, true);
    await measured();
    expect(
      screen.queryByText(PRINT_CONFIG_PAGE_LABELS.cartonMissing.title),
    ).not.toBeInTheDocument();
  });
});

/** The view-mode switch of a stored configuration: present means the person may edit. */
const EDIT = { name: "Sửa cấu hình" };

describe("VariantPrintConfig", () => {
  it("shows the SKU and name of the variant, the way back, and the saved figures of the seeded variant", async () => {
    await setStatus(SEED.productId, "Approved");
    open(SEED);
    const table = within(await measured());
    expect(table.getByRole("row", { name: /Đường kính miệng.*90,0 mm/ })).toBeInTheDocument();
    expect(table.getByRole("row", { name: /Đường kính đáy.*60,0 mm/ })).toBeInTheDocument();
    expect(table.getByRole("row", { name: /Chiều cao.*110,0 mm/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: new RegExp(SEED.variantId) }),
    ).toBeInTheDocument();
    expect(screen.getByText(SEED.variantId)).toBeInTheDocument();
    const seeded = await findMockVariant(SEED.productId, SEED.variantId);
    expect(seeded?.name).toBeTruthy();
    expect(screen.getByText(seeded?.name ?? "")).toBeInTheDocument();
    // The way back is the product's name, a link in the page band (no "Quay lại" on a detail page).
    const band = within(
      screen.getByRole("region", { name: PRINT_CONFIG_SCREEN_LABELS.cards.header }),
    );
    expect(band.getByRole("link")).toHaveAttribute(
      "href",
      ADMIN_ROUTES.products.detail(SEED.productId),
    );
    // may edit: a stored configuration opens read-only, with the switch to the edit mode
    expect(await screen.findByRole("button", EDIT)).toBeInTheDocument();
  });

  it("product access without the templates' READ says there is no access, not an empty screen", async () => {
    await setStatus(SEED.productId, "Approved");
    // Sales staff: product READ and UPDATE, no `product-customization-templates:*`.
    open(SEED, [...PRODUCT_VIEW, PRODUCT_PERMISSIONS.update]);
    expect(await screen.findByText(T.noAccess.title)).toBeInTheDocument();
    expect(screen.getByText(T.noAccess.description)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Số đo lấy từ file 3D" })).toBeNull();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
    expect(section.props).toEqual([]); // the section is not even mounted
  });

  it("M-5: a permissions load that fails says so and offers a retry, not 'no access'", async () => {
    await setStatus(SEED.productId, "Approved");
    let failing = true;
    vi.spyOn(api, "get").mockImplementation(async (url, config) => {
      if (url === "/identity/me/permissions") {
        if (failing) throw new ApiError(500, "INTERNAL_ERROR", "x");
        return { data: { roles: ["TEST"], permissions: [...FULL], dataScope: "ALL" } };
      }
      return passThrough(url, config);
    });
    renderApp(<VariantPrintConfig {...SEED} />);
    expect(await screen.findByText(T.permissionsFailed.title)).toBeInTheDocument();
    expect(screen.queryByText(T.noAccess.title)).toBeNull();
    expect(section.props).toEqual([]);

    failing = false;
    await userEvent.setup().click(screen.getByRole("button", { name: UI_LABELS.common.retry }));
    expect(await measured()).toBeInTheDocument();
    expect(screen.queryByText(T.permissionsFailed.title)).toBeNull();
  });

  it("a variant of a standard product gets the customizable-only message and no upload", async () => {
    open({ productId: "PRD-003", variantId: "SKU-003-WHT-L" });
    expect(await screen.findByText(T.notCustomizable.title)).toBeInTheDocument();
    expect(screen.getByText("SKU-003-WHT-L")).toBeInTheDocument();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
    expect(screen.queryByRole("table", { name: "Số đo lấy từ file 3D" })).toBeNull();
  });

  it("an unknown variant gets the not-found treatment", async () => {
    open({ productId: SEED.productId, variantId: "SKU-NOPE" });
    expect(await screen.findByText(T.variantNotFound.title)).toBeInTheDocument();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
  });

  it("an unknown product gets the product not-found treatment", async () => {
    open({ productId: "PRD-999", variantId: SEED.variantId });
    expect(await screen.findByText(UI_LABELS.product.notFound.title)).toBeInTheDocument();
  });

  it("without the update permission it shows the saved state and no upload", async () => {
    await setStatus(SEED.productId, "Approved");
    open(SEED, READ);
    await measured();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu cấu hình in" })).toBeNull();
  });

  it("a discontinued product gives a read-only section", async () => {
    await setStatus(SEED.productId, "Discontinued");
    open(SEED);
    await measured();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
  });

  it("an obsolete variant gives a read-only section; the same variant before is editable", async () => {
    const ids = ACTIVE_VARIANT;
    const view = open(ids);
    expect(await screen.findByLabelText(UPLOAD)).toBeInTheDocument();
    view.unmount();

    await transitionVariant({ ...ids, action: "obsolete" });
    open(ids);
    expect(await screen.findByText(NO_CONFIG)).toBeInTheDocument();
    expect(screen.queryByLabelText(UPLOAD)).toBeNull();
  });

  describe("the reason a section is read-only", () => {
    const lastReason = () => section.props.at(-1)?.readOnlyReason;
    const lastWritable = () => section.props.at(-1)?.writable;

    it("passes none when the person may edit", async () => {
      await setStatus(SEED.productId, "Approved");
      open(SEED);
      await screen.findByRole("button", EDIT);
      expect(lastWritable()).toBe(true);
      expect(lastReason()).toBeUndefined();
    });

    it("passes `permission` without the update permission", async () => {
      await setStatus(SEED.productId, "Approved");
      open(SEED, READ);
      await measured();
      expect(lastReason()).toBe("permission");
    });

    it("a product pending approval still edits its print configuration (BE only refuses a discontinued one)", async () => {
      await setStatus(SEED.productId, "Pending Approval");
      open(SEED);
      await screen.findByRole("button", EDIT);
      expect(lastWritable()).toBe(true);
      expect(lastReason()).toBeUndefined();
    });

    it("passes `product` for a discontinued product", async () => {
      await setStatus(SEED.productId, "Discontinued");
      open(SEED);
      await measured();
      expect(lastReason()).toBe("product");
    });

    it("passes `variant` for an obsolete variant of a product that accepts changes", async () => {
      await transitionVariant({ ...ACTIVE_VARIANT, action: "obsolete" });
      open(ACTIVE_VARIANT);
      await screen.findByText(NO_CONFIG);
      expect(lastReason()).toBe("variant");
    });

    it("names the permission first, then the product, then the variant, when several apply", async () => {
      await setStatus(ACTIVE_VARIANT.productId, "Discontinued");
      await transitionVariant({ ...ACTIVE_VARIANT, action: "obsolete" });
      const view = open(ACTIVE_VARIANT, READ);
      await screen.findByText(NO_CONFIG);
      expect(lastReason()).toBe("permission");
      view.unmount();
      section.props.length = 0;
      open(ACTIVE_VARIANT);
      await screen.findByText(NO_CONFIG);
      expect(lastReason()).toBe("product");
    });
  });
});
