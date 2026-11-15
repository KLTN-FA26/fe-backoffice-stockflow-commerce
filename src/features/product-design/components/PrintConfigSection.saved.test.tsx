/**
 * The section on the mock adapter: the saved state, the states around loading, permissions, and a save that changes
 * only the defaults (no file: the stored file's checksum is re-sent), failing and succeeding.
 */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  allowNone,
  EMPTY_VARIANT,
  readOnly,
  renderSection,
  templateOf,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
// The mock adapter answers after 200-500 ms, and the first render of a file is slow.
configure({ asyncUtilTimeout: 45_000 });

const SEED_SHA = "1faf14f6b7b9e7be5ac2d174dce76d7574ef5299387c001bdd0703943f65a7ea";
const SAVE = { name: "Lưu cấu hình in" };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  // The mock adapter fails 5% of requests at random and logs each one.
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function openAdvancedAndSetSeam(user: ReturnType<typeof userEvent.setup>, seam: string) {
  await user.click(await screen.findByRole("button", { name: /Nâng cao/ }));
  const field = screen.getByLabelText("Mép dán (mm)");
  await user.clear(field);
  await user.type(field, seam);
  return field;
}

describe("PrintConfigSection: the saved configuration", () => {
  it("shows the saved figures of the seeded variant: 90 / 60 / 110 and the band at 6 and 8", async () => {
    renderSection();
    const measured = await screen.findByRole("table", { name: "Số đo lấy từ file 3D" });
    const rows = within(measured);
    expect(rows.getByRole("row", { name: /Đường kính miệng.*90,0 mm/ })).toBeInTheDocument();
    expect(rows.getByRole("row", { name: /Đường kính đáy.*60,0 mm/ })).toBeInTheDocument();
    expect(rows.getByRole("row", { name: /Chiều cao.*110,0 mm/ })).toBeInTheDocument();
    expect(rows.getByRole("row", { name: /Dải in cách miệng.*6,0 mm/ })).toBeInTheDocument();
    expect(rows.getByRole("row", { name: /Dải in cách đáy.*8,0 mm/ })).toBeInTheDocument();
    expect(screen.getByText("Ly")).toBeInTheDocument();
    expect(screen.getByText("Đã đính kèm file 3D")).toBeInTheDocument();
    expect(screen.getByText("Đang dùng")).toBeInTheDocument();
    const defaults = within(screen.getByRole("table", { name: /Số mặc định/ }));
    expect(defaults.getByRole("row", { name: /Mép dán.*8,0 mm/ })).toBeInTheDocument();
  });

  it("shows a skeleton in the shape of the section while it loads", () => {
    const { container } = renderSection();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("a variant with no configuration shows what to upload and the 7-line checklist", async () => {
    renderSection(EMPTY_VARIANT);
    expect(await screen.findByText("Chưa có cấu hình in")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByLabelText("Chọn hoặc kéo thả file .glb")).toBeInTheDocument();
  });

  it("a failed load says so and a retry loads it", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new ApiError(500, "INTERNAL_ERROR", "x"));
    renderSection();
    expect(await screen.findByText("Không tải được cấu hình in.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("table", { name: "Số đo lấy từ file 3D" })).toBeInTheDocument();
  });
});

describe("PrintConfigSection: permissions", () => {
  it("without the update permission the state is readable and there is no upload and no save", async () => {
    renderSection({ can: readOnly });
    expect(await screen.findByRole("table", { name: "Số đo lấy từ file 3D" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Chọn hoặc kéo thả/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: SAVE.name })).not.toBeInTheDocument();
  });

  it("a read-only variant (discontinued product) offers neither", async () => {
    renderSection({ writable: false });
    await screen.findByRole("table", { name: "Số đo lấy từ file 3D" });
    expect(screen.queryByLabelText(/Chọn hoặc kéo thả/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: SAVE.name })).not.toBeInTheDocument();
  });

  it("without the read permission nothing is shown", () => {
    const { container } = renderSection({ can: allowNone });
    expect(container).toBeEmptyDOMElement();
  });

  it("a viewer of a variant with no configuration is only told there is none", async () => {
    renderSection({ ...EMPTY_VARIANT, can: readOnly });
    expect(await screen.findByText("Biến thể này chưa có cấu hình in.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Chọn hoặc kéo thả/)).not.toBeInTheDocument();
  });
});

describe("PrintConfigSection: a save that changes only a default", () => {
  it("the save is off until something changes", async () => {
    renderSection();
    expect(await screen.findByRole("button", { name: SAVE.name })).toBeDisabled();
    expect(screen.getByText("Chưa có thay đổi để lưu.")).toBeInTheDocument();
  });

  it("sends no file and the stored file's checksum, and shows the saved value afterwards", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await openAdvancedAndSetSeam(user, "6");
    await user.click(screen.getByRole("button", { name: SAVE.name }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [url, form] = put.mock.calls[0] ?? [];
    expect(url).toMatch(/\/customization-templates\/tpl-seed-cup12-body$/);
    expect((form as FormData).get("file")).toBeNull();
    expect(await templateOf(form)).toMatchObject({
      modelFileChecksum: SEED_SHA,
      model: { kind: "parametric-cup", seamMm: 6, topDiameterMm: 90, heightMm: 110 },
    });
    // The success toast comes from `createMutation` through a `require` that vitest cannot resolve: not asserted here.
    const defaults = within(await screen.findByRole("table", { name: /Số mặc định/ }));
    await waitFor(() =>
      expect(defaults.getByRole("row", { name: /Mép dán.*6,0 mm/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("disables the controls while it saves", async () => {
    vi.spyOn(api, "put").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderSection();
    const field = await openAdvancedAndSetSeam(user, "6");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    const saving = await screen.findByRole("button", { name: "Đang lưu…" });
    expect(saving).toBeDisabled();
    expect(field).toBeDisabled();
    expect(screen.getByLabelText("Chọn hoặc kéo thả file .glb khác")).toBeDisabled();
  });

  it("a server pair error shows the mapped sentence and the form stays filled", async () => {
    vi.spyOn(api, "put").mockRejectedValueOnce(
      new ApiError(409, "MODEL_FILE_PAIR_REQUIRED", "English"),
    );
    const user = userEvent.setup();
    renderSection();
    const field = await openAdvancedAndSetSeam(user, "6");
    await user.click(screen.getByRole("button", { name: SAVE.name }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Số đo đã đổi nhưng không kèm file .glb mới");
    expect(alert).not.toHaveTextContent("English");
    expect(field).toHaveValue(6);
    expect(screen.getByRole("button", { name: SAVE.name })).toBeEnabled();
  });

  it("a server field error goes on its field", async () => {
    vi.spyOn(api, "put").mockRejectedValueOnce(
      new ApiError(422, "PRINT_CONFIG_INVALID", "x", { "model.seamMm": "bad" }),
    );
    const user = userEvent.setup();
    renderSection();
    const field = await openAdvancedAndSetSeam(user, "6");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() =>
      expect(field).toHaveAccessibleDescription("Máy chủ không chấp nhận giá trị này."),
    );
    expect(field).toBeInvalid();
  });

  it("a default that fails its zod rule is shown on its field and nothing is sent", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole("button", { name: /Nâng cao/ }));
    const bleed = screen.getByLabelText("Tràn lề (mm)");
    await user.clear(bleed);
    await user.type(bleed, "25");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    expect(await screen.findByText("Tối đa 20 mm.")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
