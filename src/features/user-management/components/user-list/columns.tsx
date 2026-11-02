import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { roleLabel } from "@/lib/references/role-options";

import { USER_UI } from "../../constants";
import { userDisplayName } from "../../selectors";
import { UserStatusBadge } from "../UserStatusBadge";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { RoleOption } from "@/lib/references/role-options";
import type { UserDto } from "../../types";

interface ColumnContext {
  roles: readonly RoleOption[];
  /** warehouseId → tên kho; rỗng khi không có quyền đọc danh mục kho (hiện số lượng). */
  warehouseNames: ReadonlyMap<string, string>;
}

const VISIBLE_WAREHOUSES = 2;

function warehouseCell(user: UserDto, names: ReadonlyMap<string, string>) {
  if (user.warehouseIds.length === 0) {
    return <span className="text-ink-tertiary">{USER_UI.noWarehouse}</span>;
  }
  if (names.size === 0) return `${user.warehouseIds.length} kho`;
  const labels = user.warehouseIds.map((id) => names.get(id) ?? id);
  const extra = labels.length - VISIBLE_WAREHOUSES;
  return (
    <span title={labels.join(", ")}>
      {labels.slice(0, VISIBLE_WAREHOUSES).join(", ")}
      {extra > 0 && ` +${extra}`}
    </span>
  );
}

export function buildUserColumns({ roles, warehouseNames }: ColumnContext): ColumnDef<UserDto>[] {
  return [
    {
      key: "username",
      header: USER_UI.usernameLabel,
      sortable: true,
      cell: (user) => (
        <Link
          href={ADMIN_ROUTES.users.detail(user.userId)}
          onClick={(event) => event.stopPropagation()}
          className="text-ink-primary font-medium hover:underline"
        >
          {user.username}
        </Link>
      ),
    },
    {
      key: "fullName",
      header: USER_UI.fullNameLabel,
      sortable: true,
      cell: (user) => userDisplayName(user),
    },
    { key: "email", header: USER_UI.emailLabel, cell: (user) => user.email },
    {
      key: "roles",
      header: USER_UI.rolesLabel,
      cell: (user) =>
        user.roles.length === 0 ? (
          <span className="text-ink-tertiary">{USER_UI.noRoles}</span>
        ) : (
          user.roles.map((code) => roleLabel(roles, code)).join(", ")
        ),
    },
    {
      key: "warehouses",
      header: USER_UI.warehousesShort,
      cell: (user) => warehouseCell(user, warehouseNames),
    },
    {
      key: "status",
      header: USER_UI.statusLabel,
      sortable: true,
      cell: (user) => <UserStatusBadge status={user.status} />,
    },
    {
      // SCRUM-474 LOCK-REASON: why the account was last locked / unlocked / disabled / enabled
      key: "latestStatusReason",
      header: USER_UI.reasonColumn,
      cell: (user) =>
        user.latestStatusChange ? (
          <span title={user.latestStatusChange.reason} className="block max-w-[16rem] truncate">
            {user.latestStatusChange.reason}
          </span>
        ) : (
          <span className="text-ink-tertiary">{USER_UI.noReason}</span>
        ),
    },
    {
      key: "lastLoginAt",
      header: USER_UI.lastLoginLabel,
      sortable: true,
      cell: (user) =>
        user.lastLoginAt ? (
          formatDateTime(user.lastLoginAt)
        ) : (
          <span className="text-ink-tertiary">{USER_UI.neverSignedIn}</span>
        ),
    },
  ];
}
