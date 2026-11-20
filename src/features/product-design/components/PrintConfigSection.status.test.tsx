/** Activation: the buttons follow the status and the permission, confirming calls the mutation, the badge changes. */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { findStatus, readOnly, renderSection, STATUS_CARD } from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

describe("activating and stopping a saved configuration", () => {
  it("an active configuration offers to stop, not to activate; the viewer and a locked product offer neither", async () => {
    const view = renderSection();
    expect(await findStatus("Đang dùng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
    view.unmount();

    renderSection({ can: readOnly });
    await findStatus("Đang dùng");
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).not.toBeInTheDocument();
  });

  it("a locked product still offers to stop an active configuration, and never to activate", async () => {
    renderSection({ writable: false, readOnlyReason: "product" });
    await findStatus("Đang dùng");
    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
  });

  it("confirming calls the mutation and the badge changes, then the same the other way", async () => {
    const post = vi.spyOn(api, "post");
    const user = userEvent.setup();
    renderSection();
    await findStatus("Đang dùng");

    await user.click(screen.getByRole("button", { name: "Ngừng dùng" }));
    const stop = within(await screen.findByRole("dialog"));
    expect(stop.getByText(/không bắt đầu thiết kế mới/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled(); // asking is not doing
    await user.click(stop.getByRole("button", { name: "Ngừng dùng" }));

    expect(await findStatus("Chưa kích hoạt")).toBeInTheDocument();
    expect(post.mock.calls[0]?.[0]).toMatch(/\/tpl-seed-cup12-body\/deactivation$/);
    expect(post.mock.calls[0]?.[1]).toEqual({ version: 3 });
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).not.toBeInTheDocument();
    expect(screen.getByText(/khách hàng của biến thể này bắt đầu thiết kế/)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));
    const start = within(await screen.findByRole("dialog"));
    expect(start.getByText(/bắt đầu thiết kế trên cấu hình in này/)).toBeInTheDocument();
    await user.click(start.getByRole("button", { name: "Kích hoạt" }));
    expect(await findStatus("Đang dùng")).toBeInTheDocument();
    await waitFor(() => expect(post.mock.calls[1]?.[0]).toMatch(/\/activation$/));
  });

  it("hộp kích hoạt / ngừng có câu cảnh báo thiết kế chờ duyệt", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole("button", { name: "Ngừng dùng" }));
    const stop = within(await screen.findByRole("dialog"));
    expect(
      stop.getByText(/Thiết kế đang chờ duyệt dùng cấu hình này sẽ không duyệt được nữa/),
    ).toBeInTheDocument();
    // The true half of the story: a draft already on this configuration keeps it.
    expect(stop.getByText(/Bản thiết kế đang làm dở vẫn giữ cấu hình này/)).toBeInTheDocument();
    await user.click(stop.getByRole("button", { name: "Ngừng dùng" }));
    await user.click(await screen.findByRole("button", { name: "Kích hoạt" }));
    const start = within(await screen.findByRole("dialog"));
    expect(
      start.getByText(/Thiết kế đang chờ duyệt dùng cấu hình này sẽ không duyệt được nữa/),
    ).toBeInTheDocument();
    // Activating also retires the variant's active configuration: said in the warning and in the description.
    expect(start.getByText(/Cấu hình đang dùng hiện tại sẽ bị ngừng/)).toBeInTheDocument();
    expect(start.getByText(/tự ngừng dùng/)).toBeInTheDocument();
  });

  it("cancelling the confirmation changes nothing", async () => {
    const post = vi.spyOn(api, "post");
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole("button", { name: "Ngừng dùng" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Quay lại" }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("region", STATUS_CARD)).getByText("Đang dùng"),
    ).toBeInTheDocument();
  });
});
