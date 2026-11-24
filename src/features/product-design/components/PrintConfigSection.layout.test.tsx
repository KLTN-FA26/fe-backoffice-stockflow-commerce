/**
 * The page laid out as a detail page: the chosen `.glb` as a row in place of the drop box (change, discard, not yet
 * uploaded until a save), the defaults card closed by default, and the save of the right column's card submitting the
 * editor's form (its button, and Enter in one of its fields).
 */
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  CHANGE_FILE,
  CHOSEN_FILE,
  cupTree,
  DEFAULTS_TOGGLE,
  EDIT_BUTTON,
  editStored,
  EMPTY_VARIANT,
  findStatus,
  glbFile,
  loaderOf,
  NEW_FILE,
  readOnly,
  renderSection,
  REPLACE_FILE,
  STATUS_CARD,
  treeWithoutPrint,
} from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };
const NOT_UPLOADED = 'File chưa được gửi lên. Bấm "Lưu cấu hình in" để lưu file cùng cấu hình.';
const row = () => within(screen.getByRole("group", CHOSEN_FILE));

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

describe("the chosen file", () => {
  it("replaces the drop box with its row: name, size, state, and that it is not uploaded yet", async () => {
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree()) });
    await findStatus("Chưa có cấu hình in");
    expect(screen.queryByRole("group", CHOSEN_FILE)).not.toBeInTheDocument();
    await user.upload(screen.getByLabelText(NEW_FILE), glbFile("first.glb", 2048));
    await screen.findByText("Nhận ra: Ly");

    expect(row().getByText("first.glb")).toBeInTheDocument();
    expect(row().getByText("2,0 KB")).toBeInTheDocument();
    expect(row().getByText("Đã đọc, chưa lưu")).toBeInTheDocument();
    expect(row().getByRole("button", { name: "Đổi file" })).toBeEnabled();
    expect(row().getByRole("button", { name: "Bỏ file" })).toBeEnabled();
    expect(screen.getByText(NOT_UPLOADED)).toBeInTheDocument();
    // the box is gone: its words are not on the screen, the input now answers to the row
    expect(screen.queryByLabelText(NEW_FILE)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chọn hoặc kéo thả/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(CHANGE_FILE)).toHaveAccessibleDescription(NOT_UPLOADED);
  });

  it('"Đổi file" opens the same file input, and the new choice replaces the first', async () => {
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree(), treeWithoutPrint()) });
    await findStatus("Chưa có cấu hình in");
    await user.upload(screen.getByLabelText(NEW_FILE), glbFile("first.glb"));
    await screen.findByText("File: first.glb");

    const input = screen.getByLabelText(CHANGE_FILE);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("tabindex", "-1"); // the button is the keyboard stop
    const opened = vi.fn();
    input.addEventListener("click", opened);
    const change = row().getByRole("button", { name: "Đổi file" });
    change.focus();
    await user.keyboard("{Enter}");
    expect(opened).toHaveBeenCalledTimes(1);

    await user.upload(input, glbFile("second.glb"));
    expect(await screen.findByText("File: second.glb")).toBeInTheDocument();
    expect(row().getByText("second.glb")).toBeInTheDocument();
    expect(row().queryByText("first.glb")).not.toBeInTheDocument();
    expect(screen.queryByText("File: first.glb")).not.toBeInTheDocument();
  });

  it("a file dropped on the row replaces the chosen one", async () => {
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree(), cupTree()) });
    await findStatus("Chưa có cấu hình in");
    await user.upload(screen.getByLabelText(NEW_FILE), glbFile("first.glb"));
    await screen.findByText("File: first.glb");

    const dropped = glbFile("dropped.glb");
    fireEvent.drop(screen.getByRole("group", CHOSEN_FILE), {
      dataTransfer: { files: [dropped], types: ["Files"] },
    });
    expect(await screen.findByText("File: dropped.glb")).toBeInTheDocument();
    expect(row().getByText("dropped.glb")).toBeInTheDocument();
  });

  it('"Bỏ file" brings the drop box back and forgets what was read', async () => {
    const user = userEvent.setup();
    renderSection({ loadModel: loaderOf(cupTree()) });
    await findStatus("Đang dùng");
    await editStored(user);
    await user.upload(screen.getByLabelText(REPLACE_FILE), glbFile("again.glb"));
    await screen.findByText("Nhận ra: Ly");

    await user.click(row().getByRole("button", { name: "Bỏ file" }));
    expect(screen.queryByRole("group", CHOSEN_FILE)).not.toBeInTheDocument();
    const input = screen.getByLabelText(REPLACE_FILE);
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
    expect(screen.queryByText(NOT_UPLOADED)).not.toBeInTheDocument();
    expect(screen.queryByText("Nhận ra: Ly")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có thay đổi để lưu.")).toBeInTheDocument();
  });

  it("an unreadable file shows its state and says it cannot be saved", async () => {
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: () => Promise.reject(new Error("bad")) });
    await findStatus("Chưa có cấu hình in");
    await user.upload(screen.getByLabelText(NEW_FILE), glbFile("broken.glb"));
    expect(await row().findByText("Không đọc được")).toBeInTheDocument();
    expect(row().getByText("broken.glb")).toBeInTheDocument();
    expect(
      screen.getByText("File chưa được gửi lên và không lưu được. Hãy chọn file khác."),
    ).toBeInTheDocument();
    expect(screen.queryByText(NOT_UPLOADED)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SAVE.name })).toBeDisabled();
  });

  it("after a save the row goes away and the saved card names the stored file", async () => {
    const post = vi.spyOn(api, "post");
    const user = userEvent.setup();
    renderSection({ ...EMPTY_VARIANT, loadModel: loaderOf(cupTree()) });
    await findStatus("Chưa có cấu hình in");
    await user.upload(screen.getByLabelText(NEW_FILE), glbFile("cup.glb"));
    await screen.findByText("Nhận ra: Ly");
    await user.click(screen.getByRole("button", { name: SAVE.name }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    const saved = within(await screen.findByRole("region", { name: "Cấu hình đang lưu" }));
    expect(await saved.findByRole("link", { name: "Xem / tải cup.glb" })).toBeInTheDocument();
    expect(screen.queryByRole("group", CHOSEN_FILE)).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_UPLOADED)).not.toBeInTheDocument();
    // A save goes back to the view mode: changing the file again starts with "Sửa cấu hình".
    expect(screen.queryByLabelText(REPLACE_FILE)).not.toBeInTheDocument();
    expect(screen.getByRole("button", EDIT_BUTTON)).toBeInTheDocument();
  });
});

describe("the defaults card", () => {
  it("is closed by default under its plain title, and opens to the note and the fields", async () => {
    const user = userEvent.setup();
    renderSection();
    await editStored(user);
    const toggle = await screen.findByRole("button", DEFAULTS_TOGGLE);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Mép dán (mm)")).not.toBeInTheDocument();
    expect(screen.queryByText(/File 3D không cho biết mép dán/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nâng cao/ })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "File 3D không cho biết mép dán, vành miệng, chất liệu và lề in. Hệ thống điền sẵn số thường dùng; hãy kiểm lại với nhà sản xuất hoặc nhà in trước khi lưu.",
      ),
    ).toBeInTheDocument();
    for (const field of ["Lề an toàn (mm)", "Tràn lề (mm)", "Mép dán (mm)", "Vành miệng ly (mm)"]) {
      expect(screen.getByLabelText(field)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Chất liệu ly")).toBeInTheDocument();
  });

  it("is not there for a read-only viewer", async () => {
    renderSection({ can: readOnly });
    await findStatus("Đang dùng");
    expect(screen.queryByRole("button", DEFAULTS_TOGGLE)).not.toBeInTheDocument();
  });
});

describe("the status card's save", () => {
  it("sits in the status card and submits the editor's form; Enter in a field submits it too", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await findStatus("Đang dùng");
    await editStored(user);
    const card = within(screen.getByRole("region", STATUS_CARD));
    const save = card.getByRole("button", SAVE);
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", DEFAULTS_TOGGLE));
    const seam = screen.getByLabelText("Mép dán (mm)");
    await user.clear(seam);
    await user.type(seam, "6{Enter}");
    // The stored configuration asks before it saves: Enter opens the same dialog the button does.
    await user.click(
      within(await screen.findByRole("dialog", { name: "Lưu cấu hình in?" })).getByRole("button", {
        name: "Lưu cấu hình in",
      }),
    );
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toMatchObject({ model: { seamMm: 6 } });
  });

  it("a viewer's status card has no save", async () => {
    renderSection({ can: readOnly });
    await findStatus("Đang dùng");
    const card = within(screen.getByRole("region", STATUS_CARD));
    expect(card.queryByRole("button", SAVE)).not.toBeInTheDocument();
    expect(card.getByText(/Bạn không có quyền sửa cấu hình in/)).toBeInTheDocument();
  });
});

describe("view and edit of a stored configuration", () => {
  it("opens read-only with the stored defaults and file rules; Sửa cấu hình opens the form, Huỷ sửa drops the edit", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await findStatus("Đang dùng");
    // View mode: one card with what is stored, no form and no save.
    expect(screen.getByRole("table", { name: "Số không lấy từ file 3D" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Ràng buộc file" })).toBeInTheDocument();
    expect(screen.queryByRole("button", SAVE)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(REPLACE_FILE)).not.toBeInTheDocument();

    await editStored(user);
    expect(screen.getByRole("button", SAVE)).toBeDisabled();
    expect(screen.queryByRole("button", EDIT_BUTTON)).not.toBeInTheDocument();
    // The editing card does not repeat the stored defaults: they are the form.
    expect(
      screen.queryByRole("table", { name: "Số không lấy từ file 3D" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", DEFAULTS_TOGGLE));
    const seam = screen.getByLabelText("Mép dán (mm)");
    await user.clear(seam);
    await user.type(seam, "6");

    await user.click(screen.getByRole("button", { name: "Huỷ sửa" }));
    expect(await screen.findByRole("button", EDIT_BUTTON)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    // The dropped edit is gone: editing again starts from the stored value.
    await editStored(user);
    await user.click(screen.getByRole("button", DEFAULTS_TOGGLE));
    expect(screen.getByLabelText("Mép dán (mm)")).toHaveValue(8);
  });

  it("a changed field says what is stored under it, and stops saying it once back to the stored value", async () => {
    const user = userEvent.setup();
    renderSection();
    await editStored(user);
    await user.click(await screen.findByRole("button", DEFAULTS_TOGGLE));
    const seam = screen.getByLabelText("Mép dán (mm)");
    expect(screen.queryByText(/^Đang lưu:/)).not.toBeInTheDocument();
    await user.clear(seam);
    await user.type(seam, "6");
    expect(screen.getByText("Đang lưu: 8,0 mm")).toBeInTheDocument();
    await user.clear(seam);
    await user.type(seam, "8");
    expect(screen.queryByText(/^Đang lưu:/)).not.toBeInTheDocument();
  });

  it("a new configuration has no Huỷ sửa: there is nothing stored to go back to", async () => {
    renderSection(EMPTY_VARIANT);
    await findStatus("Chưa có cấu hình in");
    expect(screen.getByLabelText(NEW_FILE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", EDIT_BUTTON)).not.toBeInTheDocument();
  });

  it("a viewer has no Sửa cấu hình", async () => {
    renderSection({ can: readOnly });
    await findStatus("Đang dùng");
    expect(screen.queryByRole("button", EDIT_BUTTON)).not.toBeInTheDocument();
  });
});
