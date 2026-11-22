/** BD-7: the reference die-line of a saved print configuration — attach / replace, download, gating. */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import * as openBlob from "@/lib/files/open-blob";

import { allowAll, findStatus, readOnly, renderSection, SEED } from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SECTION = { name: "File khuôn tham chiếu" };
const INPUT = "Chọn file khuôn tham chiếu (PDF hoặc PNG)";
const pdf = (name = "khuon.pdf", size = 2048) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

/** The "File khuôn tham chiếu" card, once the saved configuration is shown. */
async function section() {
  await findStatus("Đang dùng");
  const title = await screen.findByRole("button", SECTION);
  const card = title.closest("section");
  if (!card) throw new Error("reference section not found");
  return within(card);
}

describe("File khuôn tham chiếu (BD-7)", () => {
  it("attaches a PDF: multipart PUT …/reference-file with the template's version, then shows the name", async () => {
    const put = vi.spyOn(api, "put");
    renderSection({ can: allowAll });
    const card = await section();
    expect(card.getByText("Chưa gắn file khuôn.")).toBeInTheDocument();

    await userEvent.setup().upload(card.getByLabelText(INPUT), pdf());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [url, body, config] = put.mock.calls[0] ?? [];
    expect(url).toMatch(
      new RegExp(
        `/products/${SEED.productId}/variants/${SEED.variantId}/customization-templates/[^/]+/reference-file$`,
      ),
    );
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(File);
    expect(config?.params).toEqual({ version: expect.any(Number) });
    expect(await card.findByText("khuon.pdf")).toBeInTheDocument();
    expect(card.getByText("Thay file khuôn")).toBeInTheDocument();
    // The die-line is not part of the print version: no pending-design question.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    [
      "a JPEG",
      new File([new Uint8Array(10)], "khuon.jpg", { type: "image/jpeg" }),
      "File khuôn phải là PDF hoặc PNG.",
    ],
    ["a PDF over 20 MB", pdf("big.pdf", 20 * 1024 * 1024 + 1), "File quá lớn (tối đa 20 MB)."],
  ])("refuses %s on the screen, before any request", async (_, file, message) => {
    const put = vi.spyOn(api, "put");
    renderSection({ can: allowAll });
    const card = await section();
    await userEvent.setup({ applyAccept: false }).upload(card.getByLabelText(INPUT), file);
    expect(await card.findByRole("alert")).toHaveTextContent(message);
    expect(put).not.toHaveBeenCalled();
  });

  it("without UPDATE: no attach, but the attached file can still be downloaded through a fresh link", async () => {
    const open = vi.spyOn(openBlob, "openLink").mockImplementation(() => {});
    const first = renderSection({ can: allowAll });
    await userEvent.setup().upload((await section()).getByLabelText(INPUT), pdf());
    await (await section()).findByText("khuon.pdf");
    first.unmount();

    const get = vi.spyOn(api, "get");
    renderSection({ can: readOnly });
    const card = await section();
    expect(card.queryByLabelText(INPUT)).not.toBeInTheDocument();
    await userEvent.setup().click(await card.findByRole("button", { name: "Tải về" }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(
      get.mock.calls.some(([url]) => String(url).endsWith("/reference-file/download-url")),
    ).toBe(true);
  });

  it("a product no longer sold: read-only, no attach", async () => {
    renderSection({ can: allowAll, writable: false });
    const card = await section();
    expect(card.queryByLabelText(INPUT)).not.toBeInTheDocument();
  });
});
