import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SALES_WORKLOAD_PERMISSIONS } from "@/constants/sales-owner";
import { ApiError } from "@/lib/api/error";

import { PERMISSION_SETS, renderIdentityScreen, stubIdentityApi } from "../__fixtures__/render";
import { userFixture } from "../__fixtures__/users";

import { UserDetailPage } from "./UserDetailPage";

import type { PermissionCode } from "@/lib/auth";
import type { Handler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/shared/Toast", () => ({ toast }));

afterEach(() => vi.restoreAllMocks());

const ID = "11111111-1111-4111-8111-111111111111";
const url = `/identity/users/${ID}`;
const SUMMARY = `GET ${url}/handover-summary`;

function setup(
  routes: Record<string, Handler>,
  permissions: readonly PermissionCode[] = PERMISSION_SETS.editor,
) {
  const api = stubIdentityApi(permissions, { [`GET ${url}`]: () => userFixture({}), ...routes });
  renderIdentityScreen(<UserDetailPage id={ID} />);
  return { api, user: userEvent.setup() };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, button: string) {
  await user.click(await screen.findByRole("button", { name: button }));
  return within(await screen.findByRole("dialog"));
}

describe("Khoá / vô hiệu hoá tài khoản Sale — việc đang phụ trách (KE-HOACH BR-S08)", () => {
  it("BR-S08: the lock confirmation says what goes back to assignment, with a link to the assignment screen", async () => {
    const { user } = setup({
      [SUMMARY]: () => ({ customers: 12, openConversations: 3, openLeads: 2 }),
    });
    const dialog = await openDialog(user, "Khoá tài khoản");
    expect(
      await dialog.findByText(
        "Sale này đang phụ trách 12 khách, 3 hội thoại mở, 2 khách tiềm năng; sau khi khoá sẽ chuyển sang chờ giao.",
      ),
    ).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "Mở màn Phân công khách" })).toHaveAttribute(
      "href",
      "/admin/sales/assignment",
    );
    // BR-S08: khoá được ngay (an ninh) — không bắt giao khách trước.
    await user.type(dialog.getByLabelText(/Lý do/), "Nghỉ việc từ hôm nay");
    expect(dialog.getByRole("button", { name: "Khoá tài khoản" })).toBeEnabled();
  });

  it("BR-S08: disabling says 'sau khi vô hiệu hoá'", async () => {
    const { user } = setup({
      [SUMMARY]: () => ({ customers: 1, openConversations: 0, openLeads: 0 }),
    });
    const dialog = await openDialog(user, "Vô hiệu hoá");
    expect(
      await dialog.findByText(/sau khi vô hiệu hoá sẽ chuyển sang chờ giao\./),
    ).toBeInTheDocument();
  });

  it("BR-S08: conversations missing from the summary come from the chat workload when the viewer may read it", async () => {
    const { user } = setup(
      {
        [SUMMARY]: () => ({ customers: 4 }),
        "GET /chat/agents/workload": () => [{ userId: ID, openConversations: 5 }],
      },
      [...PERMISSION_SETS.editor, SALES_WORKLOAD_PERMISSIONS.read],
    );
    const dialog = await openDialog(user, "Khoá tài khoản");
    expect(
      await dialog.findByText(/Sale này đang phụ trách 4 khách, 5 hội thoại mở;/),
    ).toBeInTheDocument();
  });

  it("fallback: endpoint unavailable (404) → today's dialog, unchanged", async () => {
    const { user, api } = setup({
      [SUMMARY]: () => {
        throw new ApiError(404, "NOT_FOUND", "Not found");
      },
    });
    const dialog = await openDialog(user, "Khoá tài khoản");
    await waitFor(() => expect(api.of("get", `${url}/handover-summary`)).toHaveLength(1));
    expect(dialog.queryByText(/Sale này đang phụ trách/)).not.toBeInTheDocument();
    expect(dialog.getByText(/Tài khoản bị đăng xuất khỏi mọi thiết bị/)).toBeInTheDocument();
  });

  it("an account with nothing to hand over (not a Sales) → no note", async () => {
    const { user, api } = setup({
      [SUMMARY]: () => ({ customers: 0, openConversations: 0, openLeads: 0 }),
    });
    const dialog = await openDialog(user, "Khoá tài khoản");
    await waitFor(() => expect(api.of("get", `${url}/handover-summary`)).toHaveLength(1));
    expect(dialog.queryByText(/Sale này đang phụ trách/)).not.toBeInTheDocument();
  });

  it("the summary is read only once the lock / disable dialog opens", async () => {
    const { api } = setup({});
    await screen.findByRole("button", { name: "Khoá tài khoản" });
    expect(api.of("get", `${url}/handover-summary`)).toHaveLength(0);
  });
});
