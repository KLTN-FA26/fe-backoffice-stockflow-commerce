import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PERMISSIONS, PRODUCT_REJECT_LABELS, PRODUCT_STATUS } from "@/constants";
import { ApiError } from "@/lib/api";

import { installApi, renderApp } from "../product-test-utils";
import { ProductRejectDialog } from "./ProductRejectDialog";

import type { Product } from "../types";

const ID = "11111111-1111-4111-8111-111111111111";
const product: Product = {
  productId: ID,
  code: "PRD-1",
  name: "Ly giấy",
  nameEn: "Paper cup",
  type: "Standard",
  categoryId: null,
  status: PRODUCT_STATUS.PENDING_APPROVAL,
  version: 3,
  description: "",
  descriptionEn: "",
  images: [],
  taxClass: "standard",
  brand: "Brand",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "tester",
};
/** BE `ProductResponse` sau khi từ chối: về DRAFT. */
const rejected = {
  productId: ID,
  code: "PRD-1",
  name: "Ly giấy",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "DRAFT",
  version: 4,
  createdAt: "2026-01-01T00:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

async function openDialog(post: (url: string, body?: unknown) => unknown) {
  const api = installApi({ permissions: [PRODUCT_PERMISSIONS.approve], post });
  const onClose = vi.fn();
  renderApp(<ProductRejectDialog product={product} open onClose={onClose} />);
  const dialog = await screen.findByRole("dialog", { name: PRODUCT_REJECT_LABELS.title });
  return { ...api, onClose, dialog };
}

describe("ProductRejectDialog — từ chối duyệt cần lý do (BE RejectProductRequest @NotBlank)", () => {
  it("chưa nhập lý do thì không gửi; có lý do gửi { reason } đã cắt khoảng trắng tới /rejection", async () => {
    const user = userEvent.setup();
    const { post, onClose, dialog } = await openDialog((url) =>
      url === `/products/${ID}/rejection` ? rejected : undefined,
    );
    const confirm = within(dialog).getByRole("button", { name: PRODUCT_REJECT_LABELS.confirm });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByRole("textbox", { name: new RegExp(PRODUCT_REJECT_LABELS.reasonLabel) }),
      "  Thiếu ảnh bìa  ",
    );
    await user.click(confirm);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith(`/products/${ID}/rejection`, { reason: "Thiếu ảnh bìa" });
  });

  it("409 trạng thái đã đổi: báo trong hộp thoại, giữ lý do, không đóng", async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = await openDialog(() => {
      throw new ApiError(409, "INVALID_PRODUCT_STATUS_TRANSITION", "x");
    });
    const reason = within(dialog).getByRole("textbox", {
      name: new RegExp(PRODUCT_REJECT_LABELS.reasonLabel),
    });
    await user.type(reason, "Sai giá");
    await user.click(within(dialog).getByRole("button", { name: PRODUCT_REJECT_LABELS.confirm }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Trạng thái sản phẩm/);
    expect(reason).toHaveValue("Sai giá");
    expect(onClose).not.toHaveBeenCalled();
  });
});
