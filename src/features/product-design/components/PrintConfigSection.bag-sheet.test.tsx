/**
 * A bag's flat sheet in the form: the glue flap and bottom fold pre-filled as the BE defaults them, the sheet redrawn as
 * the person types, the BE's rules checked before sending, both values in the saved model, and a server refusal of
 * either put on its field.
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
import { blobBytes } from "@/lib/crypto/blob-bytes";

import {
  bagTree,
  EMPTY_VARIANT,
  glbFile,
  loaderOf,
  renderSection,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

/** The 260 × 120 × 280 bag of `bagTree`, read, with "Nâng cao" open and the top fold at 40 mm (the pinned example). */
async function chooseBagWithFold40() {
  const user = userEvent.setup();
  renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(bagTree()) });
  await screen.findByText("Chưa có cấu hình in");
  await user.upload(screen.getByLabelText(/Chọn hoặc kéo thả file/), glbFile());
  await screen.findByText("Nhận ra: Túi");
  await user.click(screen.getByRole("button", { name: /Nâng cao/ }));
  const fold = screen.getByLabelText("Gập miệng túi (mm)");
  await user.clear(fold);
  await user.type(fold, "40");
  return user;
}

async function sentModel(post: ReturnType<typeof vi.spyOn>) {
  const form = post.mock.calls[0]?.[1];
  if (!(form instanceof FormData)) throw new Error("expected a multipart body");
  const part = form.get("template");
  if (!(part instanceof Blob)) throw new Error("expected the template part");
  return (JSON.parse(new TextDecoder().decode(await blobBytes(part))) as { model: object }).model;
}

describe("the flat sheet of a new bag", () => {
  it("pre-fills glue flap 20 and bottom fold round2(0.6 × gusset 120) = 72, and draws 780 × 392 / 786 × 398", async () => {
    await chooseBagWithFold40();
    expect(screen.getByLabelText("Mép dán (mm)")).toHaveValue(20);
    expect(screen.getByLabelText("Gấp đáy (mm)")).toHaveValue(72);
    const preview = within(screen.getByRole("region", { name: "Tấm trải phẳng" }));
    expect(
      preview.getByRole("img", {
        name: "Tấm trải phẳng 780,0 mm × 392,0 mm, có tràn lề 786,0 mm × 398,0 mm",
      }),
    ).toBeInTheDocument();
    expect(
      preview.getByText(/Mép dán 20,0 mm · Mặt trước 260,0 mm · Hông phải 120,0 mm/),
    ).toBeInTheDocument();
    expect(
      preview.getByText("Gập miệng 40,0 mm · Mặt in 280,0 mm · Gấp đáy 72,0 mm"),
    ).toBeInTheDocument();
  });

  it("redraws as the glue flap is typed", async () => {
    const user = await chooseBagWithFold40();
    const glue = screen.getByLabelText("Mép dán (mm)");
    await user.clear(glue);
    await user.type(glue, "30");
    const preview = within(screen.getByRole("region", { name: "Tấm trải phẳng" }));
    expect(preview.getByText("790,0 mm × 392,0 mm")).toBeInTheDocument();
  });

  it("a bottom fold deeper than the gusset is refused on its field and nothing is sent", async () => {
    const post = vi.spyOn(api, "post");
    const user = await chooseBagWithFold40();
    const fold = screen.getByLabelText("Gấp đáy (mm)");
    await user.clear(fold);
    await user.type(fold, "121");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() =>
      expect(fold).toHaveAccessibleDescription("Không sâu hơn hông túi (120,0 mm)."),
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("saves the glue flap and bottom fold in the model", async () => {
    const post = vi.spyOn(api, "post");
    const user = await chooseBagWithFold40();
    const fold = screen.getByLabelText("Gấp đáy (mm)");
    await user.clear(fold);
    await user.type(fold, "60");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(await sentModel(post)).toMatchObject({
      kind: "parametric-bag",
      topFoldMm: 40,
      glueFlapMm: 20,
      bottomFoldMm: 60,
    });
    expect(await screen.findByText("Đã đính kèm file 3D")).toBeInTheDocument();
  });

  it("a PRINT_CONFIG_INVALID field error on model.glueFlapMm goes on the glue flap field", async () => {
    const list = [
      { field: "model.glueFlapMm", message: "A bag's glue flap is 0 to 100 mm", code: "Range" },
    ];
    vi.spyOn(api, "post").mockRejectedValueOnce(
      new ApiError(
        400,
        "PRINT_CONFIG_INVALID",
        "x",
        { "model.glueFlapMm": "bad" },
        undefined,
        undefined,
        list,
      ),
    );
    const user = await chooseBagWithFold40();
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    const glue = screen.getByLabelText("Mép dán (mm)");
    await waitFor(() =>
      expect(glue).toHaveAccessibleDescription("Máy chủ không chấp nhận giá trị này."),
    );
    expect(glue).toBeInvalid();
  });
});
