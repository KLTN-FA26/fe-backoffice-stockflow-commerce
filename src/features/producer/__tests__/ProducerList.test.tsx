import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCER_PERMISSIONS, PRODUCTION_LABELS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { ProducerList } from "../components/ProducerList";

import type { PermissionCode } from "@/lib/auth";

const L = PRODUCTION_LABELS.producer;
const P = PRODUCER_PERMISSIONS;
const COORDINATOR = [P.viewPage, P.read, P.create, P.update] as PermissionCode[];
const SALES_MANAGER = [P.viewPage, P.read] as PermissionCode[];

const producer = {
  id: "p-1",
  code: "IN-MINHPHAT",
  name: "In Minh Phát",
  contactName: "Chị Lan",
  email: "don@minhphat.vn",
  channel: "EMAIL",
  standardLeadDays: 14,
  status: "ACTIVE",
  version: 4,
};
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
});

afterEach(() => vi.restoreAllMocks());

describe("ProducerList (docs 17 §4.3)", () => {
  it("Sales Manager chỉ xem: thấy bảng, không có nút thêm / sửa", async () => {
    mockProductionApi(SALES_MANAGER, { get: { "/producers": () => page([producer]) } });
    renderProductionScreen(<ProducerList />);
    expect(await screen.findByText("IN-MINHPHAT")).toBeInTheDocument();
    expect(screen.getByText(L.days(14))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.create })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${L.edit} IN-MINHPHAT` })).not.toBeInTheDocument();
  });

  it("Điều phối sản xuất ngừng dùng một đơn vị: PUT kèm version đã đọc, không gửi mã", async () => {
    const user = userEvent.setup();
    const { put } = mockProductionApi(COORDINATOR, {
      get: { "/producers": () => page([producer]) },
      put: { "/producers/p-1": (_, body) => ({ ...producer, ...(body as object), version: 5 }) },
    });
    renderProductionScreen(<ProducerList />);
    await user.click(await screen.findByRole("button", { name: `${L.edit} IN-MINHPHAT` }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: new RegExp(L.form.status) }));
    await user.click(await screen.findByRole("option", { name: "Ngừng dùng" }));
    await user.click(within(dialog).getByRole("button", { name: L.form.submitEdit }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [, body] = put.mock.calls[0] ?? [];
    expect(body).toMatchObject({ status: "INACTIVE", version: 4, name: "In Minh Phát" });
    expect(body).not.toHaveProperty("code");
  });

  it("kênh Email chưa có email → không thêm được; nhập email thì thêm được", async () => {
    const user = userEvent.setup();
    mockProductionApi(COORDINATOR, { get: { "/producers": () => page([]) } });
    renderProductionScreen(<ProducerList />);
    await user.click(await screen.findByRole("button", { name: new RegExp(L.create) }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(new RegExp(`^${L.form.code}`)), "IN-B");
    await user.type(within(dialog).getByLabelText(new RegExp(`^${L.form.name}`)), "In B");
    const submit = within(dialog).getByRole("button", { name: L.form.submitCreate });
    await waitFor(() => expect(submit).toBeDisabled());
    await user.type(within(dialog).getByLabelText(new RegExp(`^${L.form.email}`)), "don@b.vn");
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
