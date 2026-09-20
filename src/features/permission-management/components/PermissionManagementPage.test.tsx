import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import type { RoleMatrix, RoleResponse } from "../types";

const { useRolesMock, useMatrixMock } = vi.hoisted(() => ({
  useRolesMock: vi.fn(),
  useMatrixMock: vi.fn(),
}));

vi.mock("../queries", () => ({
  useRoles: useRolesMock,
  useRolePermissionMatrix: useMatrixMock,
}));

import { PermissionManagementPage } from "./PermissionManagementPage";

const roles: RoleResponse[] = [
  {
    code: "ROLE_A",
    name: "Role A",
    description: null,
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: null,
    lastModifiedAt: null,
    lastModifiedBy: null,
  },
  {
    code: "ROLE_B",
    name: "Role B",
    description: "Second role",
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: "flyway",
    lastModifiedAt: null,
    lastModifiedBy: null,
  },
];

const matrix = (roleCode: string, roleLabel = roleCode): RoleMatrix => ({
  roleCode,
  roleLabel,
  systemRole: true,
  dataScope: "ALL",
  grantedCount: 1,
  totalCount: 2,
  groups: [
    {
      name: "Dynamic Group",
      grantedCount: 1,
      totalCount: 2,
      resources: [
        {
          code: "unknown-resource",
          label: "Unknown resource",
          route: "/admin/unknown",
          apiPath: "/api/v1/unknown",
          grantedCount: 1,
          totalCount: 2,
          actions: [
            { action: "READ", label: "Read data", granted: true, sensitive: false },
            { action: "EXPORT", label: "Export", granted: false, sensitive: true },
          ],
        },
      ],
    },
  ],
});

function rolesQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: roles,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function matrixQuery(value: RoleMatrix, overrides: Record<string, unknown> = {}) {
  return {
    data: value,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("PermissionManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRolesMock.mockReturnValue(rolesQuery());
    useMatrixMock.mockImplementation((roleCode: string) => matrixQuery(matrix(roleCode)));
  });

  it("renders roles and selects the first valid role initially", async () => {
    render(<PermissionManagementPage />);

    const selector = await screen.findByLabelText("Chọn vai trò để xem ma trận quyền");
    await waitFor(() => expect(selector).toHaveValue("ROLE_A"));
    expect(screen.getByRole("option", { name: "Role B" })).toBeInTheDocument();
  });

  it("fetches and renders the newly selected role without showing the previous matrix", async () => {
    const user = userEvent.setup();
    let pendingRole = "";
    useMatrixMock.mockImplementation((roleCode: string) =>
      pendingRole === roleCode
        ? matrixQuery(matrix(roleCode), { data: undefined, isPending: true })
        : matrixQuery(matrix(roleCode, `Label ${roleCode}`)),
    );

    const view = render(<PermissionManagementPage />);
    const selector = await screen.findByLabelText("Chọn vai trò để xem ma trận quyền");
    await waitFor(() => expect(selector).toHaveValue("ROLE_A"));

    pendingRole = "ROLE_B";
    await user.selectOptions(selector, "ROLE_B");
    expect(screen.getByText("Đang tải ma trận của vai trò...")).toBeInTheDocument();
    expect(screen.queryByText("Label ROLE_A")).not.toBeInTheDocument();

    pendingRole = "";
    view.rerender(<PermissionManagementPage />);
    expect(await screen.findByText("Label ROLE_B")).toBeInTheDocument();
    expect(useMatrixMock).toHaveBeenLastCalledWith("ROLE_B");
  });

  it("renders dynamic groups, resources, granted, non-granted, sensitive, and system states", async () => {
    render(<PermissionManagementPage />);

    expect(await screen.findByText("Dynamic Group")).toBeInTheDocument();
    expect(screen.getByText("Unknown resource")).toBeInTheDocument();
    expect(screen.getByText("Được cấp")).toBeInTheDocument();
    expect(screen.getByText("Chưa cấp")).toBeInTheDocument();
    expect(screen.getByText("Nhạy cảm")).toBeInTheDocument();
    expect(screen.getByText("System role · chỉ xem")).toBeInTheDocument();
    expect(screen.getByText("Phạm vi dữ liệu: ALL")).toBeInTheDocument();
  });

  it("renders an empty role list distinctly", () => {
    useRolesMock.mockReturnValue(rolesQuery({ data: [] }));

    render(<PermissionManagementPage />);

    expect(screen.getByText("Chưa có vai trò")).toBeInTheDocument();
    expect(screen.queryByText("Không có quyền xem ma trận phân quyền")).not.toBeInTheDocument();
  });

  it("renders empty groups, resources, and actions safely", async () => {
    const emptyMatrix = (groups: RoleMatrix["groups"]): RoleMatrix => ({
      ...matrix("ROLE_A"),
      groups,
    });
    const cases: Array<[RoleMatrix["groups"], string]> = [
      [[], "Chưa có nhóm quyền"],
      [
        [{ name: "Empty resources", grantedCount: 0, totalCount: 0, resources: [] }],
        "Chưa có resource",
      ],
      [
        [
          {
            name: "Empty actions",
            grantedCount: 0,
            totalCount: 0,
            resources: [
              {
                code: "empty-resource",
                label: "Empty resource",
                route: "/admin/empty",
                apiPath: "/api/v1/empty",
                grantedCount: 0,
                totalCount: 0,
                actions: [],
              },
            ],
          },
        ],
        "Chưa có action",
      ],
    ];

    for (const [groups, emptyText] of cases) {
      useMatrixMock.mockReturnValue(matrixQuery(emptyMatrix(groups)));
      const view = render(<PermissionManagementPage />);
      expect(await screen.findByText(emptyText)).toBeInTheDocument();
      view.unmount();
    }
  });

  it.each([
    [403, "Không có quyền xem ma trận phân quyền"],
    [404, "Không tìm thấy ma trận phân quyền"],
  ])("renders dedicated matrix error state for %s", async (status, title) => {
    useMatrixMock.mockReturnValue(
      matrixQuery(matrix("ROLE_A"), {
        data: undefined,
        isPending: false,
        isError: true,
        error: new ApiError(status, status === 403 ? "FORBIDDEN" : "ROLE_NOT_FOUND", "error"),
      }),
    );

    render(<PermissionManagementPage />);

    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("renders a retryable generic state for network/server errors", async () => {
    const refetch = vi.fn();
    useMatrixMock.mockReturnValue(
      matrixQuery(matrix("ROLE_A"), {
        data: undefined,
        isPending: false,
        isError: true,
        error: new ApiError(500, "INTERNAL_ERROR", "error"),
        refetch,
      }),
    );

    render(<PermissionManagementPage />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Tải lại" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders a resource and action supplied by the response", async () => {
    const dynamic = matrix("ROLE_A");
    const resource = dynamic.groups[0]?.resources[0];
    if (!resource) throw new Error("Fixture must include a resource");
    resource.actions = [
      { action: "CREATE", label: "Create dynamically", granted: true, sensitive: false },
    ];
    useMatrixMock.mockReturnValue(matrixQuery(dynamic));

    render(<PermissionManagementPage />);

    expect(await screen.findByText("Create dynamically")).toBeInTheDocument();
  });
});
