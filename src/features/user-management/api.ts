/**
 * Quản lý người dùng — API layer, khớp BE `UserManagementController` + `IdentityController` (PR #72/#73).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`. Parse tại biên (api-conventions §3.2).
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  assignWarehousesSchema,
  createdUserSchema,
  passwordResetResultSchema,
  updateUserFormSchema,
  userDtoSchema,
  userPageSchema,
} from "./schemas";
import { toCreateUserRequest } from "./selectors";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreatedUser,
  CreateUserFormValues,
  PasswordResetResult,
  UpdateUserFormValues,
  UserDto,
  UserStatus,
  UserStatusAction,
} from "./types";

const USERS_PATH = "/identity/users";
const userPath = (userId: string) => `${USERS_PATH}/${encodeURIComponent(userId)}`;

export interface ListUserParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  /** Tìm theo tên đăng nhập / họ tên / email. */
  q?: string;
  status?: UserStatus;
  /** Mã vai trò. */
  role?: string;
  /** `field,asc|desc` — BE chỉ nhận username / fullName / status / lastLoginAt / createdAt. */
  sort?: string;
}

export async function listUsers(
  params: ListUserParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<UserDto>> {
  const { page = 0, size = PAGE_SIZE.lg, q, status, role, sort } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (q?.trim()) query.set("q", q.trim());
  if (status) query.set("status", status);
  if (role) query.set("role", role);
  if (sort?.trim()) query.set("sort", sort.trim());
  const { data } = await api.get<unknown>(USERS_PATH, { params: query, signal });
  return userPageSchema.parse(data);
}

export async function getUser(userId: string, signal?: AbortSignal): Promise<UserDto> {
  const { data } = await api.get<unknown>(userPath(userId), { signal });
  return userDtoSchema.parse(data);
}

export async function createUser(values: CreateUserFormValues): Promise<CreatedUser> {
  const { data } = await api.post<unknown>(USERS_PATH, toCreateUserRequest(values));
  return createdUserSchema.parse(data);
}

export interface UpdateUserInput {
  userId: string;
  values: UpdateUserFormValues;
  /** Phiên bản đã tải — BE trả 409 OPTIMISTIC_LOCK nếu đã đổi. */
  version: number;
}

export async function updateUser({ userId, values, version }: UpdateUserInput): Promise<UserDto> {
  const { email, fullName } = updateUserFormSchema.parse(values);
  const { data } = await api.patch<unknown>(userPath(userId), { email, fullName, version });
  return userDtoSchema.parse(data);
}

/** `PUT /users/{id}/warehouses` — thay toàn bộ tập kho (rỗng = gỡ hết). */
export async function assignWarehouses(userId: string, warehouseIds: string[]): Promise<UserDto> {
  const body = assignWarehousesSchema.parse({ warehouseIds });
  const { data } = await api.put<unknown>(`${userPath(userId)}/warehouses`, body);
  return userDtoSchema.parse(data);
}

export interface ChangeStatusInput {
  userId: string;
  action: UserStatusAction;
}

/** lock / unlock / disable / enable — BE không nhận body, lock / disable kết thúc mọi phiên của tài khoản. */
export async function changeUserStatus({ userId, action }: ChangeStatusInput): Promise<UserDto> {
  const { data } = await api.post<unknown>(`${userPath(userId)}/${action}`);
  return userDtoSchema.parse(data);
}

export interface ResetPasswordInput {
  userId: string;
  /** Bỏ trống để BE tự sinh mật khẩu tạm (trả về một lần). */
  newPassword?: string;
}

export async function resetPassword({
  userId,
  newPassword,
}: ResetPasswordInput): Promise<PasswordResetResult> {
  const { data } = await api.post<unknown>(
    `${userPath(userId)}/password-reset`,
    newPassword ? { newPassword } : {},
  );
  return passwordResetResultSchema.parse(data);
}

/** `POST /identity/users/{id}/roles` — gán một vai trò (201, không có body). */
export async function assignRole(userId: string, roleCode: string): Promise<void> {
  await api.post(`${userPath(userId)}/roles`, { roleCode });
}

/** `DELETE /identity/users/{id}/roles/{code}` — gỡ một vai trò. */
export async function revokeRole(userId: string, roleCode: string): Promise<void> {
  await api.delete(`${userPath(userId)}/roles/${encodeURIComponent(roleCode)}`);
}
