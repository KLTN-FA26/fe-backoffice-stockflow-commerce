import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDENTITY_PERMISSIONS } from "@/constants/permissions";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { editorMatrix } from "./__fixtures__/matrix";
import { customRole } from "./__fixtures__/roles";
import { RoleAdminBar } from "./components/RoleAdminBar";
import { useRoles } from "./queries";
import { useUpdateRolePermissions } from "./mutations";

const granted = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock("@/lib/auth/components/Can", () => ({ useCan: (code: string) => granted.codes.has(code) }));
vi.mock("@/components/shared/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let serverVersion: number;
let roleGets: number;

/** Role list + rename dialog fed by the real `useRoles`, plus a button that saves the permission matrix. */
function Harness() {
  const roles = useRoles();
  const save = useUpdateRolePermissions();
  const list = roles.data ?? [];
  return (
    <>
      <button
        type="button"
        onClick={() =>
          save.mutate({ roleCode: "SHIFT_LEAD", input: { version: 0, permissions: [] } })
        }
      >
        save matrix
      </button>
      <RoleAdminBar roles={list} selected={list[0]} onSelect={vi.fn()} />
    </>
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  granted.codes = new Set([IDENTITY_PERMISSIONS.rolesUpdate, IDENTITY_PERMISSIONS.rbacApprove]);
  serverVersion = 2;
  roleGets = 0;
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/identity/roles") {
      roleGets += 1;
      return { data: [customRole({ version: serverVersion })] };
    }
    throw new Error(`unexpected GET ${url}`);
  });
  vi.spyOn(api, "put").mockImplementation(async () => {
    serverVersion += 1; // BE: saving the matrix bumps the role's own version
    return { data: { ...editorMatrix(1), roleCode: "SHIFT_LEAD" } };
  });
});
afterEach(() => vi.restoreAllMocks());

describe("role version after a matrix save (BE bumps it)", () => {
  it("renaming right after a matrix save sends the NEW version, not the stale one", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: customRole({ version: 4 }) });
    const user = setup();
    await screen.findByRole("button", { name: /Đổi tên/ });
    await user.click(screen.getByRole("button", { name: "save matrix" }));
    await waitFor(() => expect(roleGets).toBeGreaterThan(1));

    await user.click(screen.getByRole("button", { name: /Đổi tên/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText(/Tên vai trò/), "!");
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0]?.[1]).toMatchObject({ version: 3 });
  });

  it("on OPTIMISTIC_LOCK the role list is reloaded, so the 'reloaded' message is true and a retry works", async () => {
    const patch = vi
      .spyOn(api, "patch")
      .mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "stale"))
      .mockResolvedValue({ data: customRole({ version: 6 }) });
    const user = setup();
    await user.click(await screen.findByRole("button", { name: /Đổi tên/ }));
    const dialog = within(await screen.findByRole("dialog"));
    serverVersion = 5; // someone else changed it meanwhile
    const before = roleGets;
    await user.type(dialog.getByLabelText(/Tên vai trò/), "!");
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    expect(await dialog.findByText(/Đã tải lại bản mới nhất/)).toBeInTheDocument();
    await waitFor(() => expect(roleGets).toBeGreaterThan(before));

    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[1]?.[1]).toMatchObject({ version: 5 });
  });
});
