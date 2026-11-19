/**
 * A failed save keeps the person's work (the editor is keyed by the variant, so a refetch never remounts it), a
 * discarded file puts the form back to the stored configuration, and a read-only section says why.
 */
import { configure, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  allowAll,
  bagTree,
  cupTree,
  DEFAULTS_TOGGLE,
  EMPTY_VARIANT,
  FILE_INPUT,
  findStatus,
  glbFile,
  loaderOf,
  readOnly,
  renderSection,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };
const upload = (file: File) => userEvent.setup().upload(screen.getByLabelText(FILE_INPUT), file);

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function setSeam(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.click(await screen.findByRole("button", DEFAULTS_TOGGLE));
  const seam = screen.getByLabelText("Mép dán (mm)");
  await user.clear(seam);
  await user.type(seam, value);
  return seam;
}

/** The chosen file, its report, the typed default and the error are all still there. */
function expectWorkKept(seam: HTMLElement, fileName: string) {
  expect(screen.getByText("Nhận ra: Ly")).toBeInTheDocument();
  expect(screen.getByText(`File: ${fileName}`)).toBeInTheDocument();
  expect(seam).toHaveValue(6);
  expect(screen.getByText(/Cấu hình in chưa hợp lệ/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: SAVE.name })).toBeEnabled();
}

describe("a failed save", () => {
  it("on a new configuration keeps the file, the report, the defaults and the error, and a retry succeeds", async () => {
    const get = vi.spyOn(api, "get");
    vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(400, "PRINT_CONFIG_INVALID", "x"));
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree()) });
    await findStatus("Chưa có cấu hình in");
    await upload(glbFile("new.glb"));
    await screen.findByText("Nhận ra: Ly");
    const seam = await setSeam(user, "6");
    const gets = get.mock.calls.length;
    await user.click(screen.getByRole("button", { name: SAVE.name }));

    await screen.findByText(/Cấu hình in chưa hợp lệ/);
    // the refetch after the failure must not remount the editor
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(gets));
    expectWorkKept(seam, "new.glb");

    await user.click(screen.getByRole("button", { name: SAVE.name }));
    expect(await screen.findByText("Đã đính kèm file 3D")).toBeInTheDocument();
  });

  it("when replacing a file keeps the same things, and a retry succeeds", async () => {
    const get = vi.spyOn(api, "get");
    vi.spyOn(api, "put").mockRejectedValueOnce(new ApiError(400, "PRINT_CONFIG_INVALID", "x"));
    const user = userEvent.setup();
    renderSection({ loadModel: loaderOf(cupTree()) });
    await screen.findByText("Đã đính kèm file 3D");
    await upload(glbFile("again.glb"));
    await screen.findByText("Nhận ra: Ly");
    const seam = await setSeam(user, "6");
    const gets = get.mock.calls.length;
    await user.click(screen.getByRole("button", { name: SAVE.name }));

    await screen.findByText(/Cấu hình in chưa hợp lệ/);
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(gets));
    expectWorkKept(seam, "again.glb");

    await user.click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() => expect(screen.queryByText("File: again.glb")).not.toBeInTheDocument());
    expect(screen.queryByText(/Cấu hình in chưa hợp lệ/)).not.toBeInTheDocument();
  });
});

describe("discarding a chosen file", () => {
  it("puts the form back to the stored cup: a later save carries the cup margins, not the bag ones", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection({ loadModel: loaderOf(bagTree()) });
    await screen.findByText("Đã đính kèm file 3D");
    await upload(glbFile("bag.glb"));
    await screen.findByText("Nhận ra: Túi");
    await user.click(screen.getByRole("button", { name: "Bỏ file" }));
    await waitFor(() => expect(screen.queryByText("Nhận ra: Túi")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", DEFAULTS_TOGGLE));
    const rim = screen.getByLabelText("Vành miệng ly (mm)");
    await user.clear(rim);
    await user.type(rim, "4");
    expect(screen.getByLabelText("Lề an toàn (mm)")).toHaveValue(3);
    await user.click(screen.getByRole("button", { name: SAVE.name }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    // One JSON request: the stored file stays.
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      model: { kind: "parametric-cup", rimMm: 4 },
      printAreas: [{ code: "BODY", safeMarginMm: 3, bleedMm: 2 }],
    });
  });
});

describe("a read-only section says why", () => {
  it("without the update permission", async () => {
    renderSection({ can: readOnly });
    expect(await screen.findByText(/Bạn không có quyền sửa cấu hình in/)).toBeInTheDocument();
  });

  it("when the page says the product does not accept changes", async () => {
    renderSection({ can: allowAll, writable: false, readOnlyReason: "product" });
    expect(await screen.findByText(/đang chờ duyệt hoặc đã ngừng kinh doanh/)).toBeInTheDocument();
  });

  it("when the page says the variant is no longer in use", async () => {
    renderSection({ can: allowAll, writable: false, readOnlyReason: "variant" });
    expect(await screen.findByText(/Biến thể này đã ngừng dùng/)).toBeInTheDocument();
  });

  it("a reason the page names wins over the permission", async () => {
    renderSection({ can: readOnly, readOnlyReason: "variant" });
    expect(await screen.findByText(/Biến thể này đã ngừng dùng/)).toBeInTheDocument();
    expect(screen.queryByText(/Bạn không có quyền/)).not.toBeInTheDocument();
  });

  it("an editor sees no such sentence", async () => {
    renderSection();
    await screen.findByText("Đã đính kèm file 3D");
    expect(screen.queryByText(/chỉ xem được|không sửa được|chưa sửa được/)).not.toBeInTheDocument();
  });
});
