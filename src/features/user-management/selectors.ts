import type { CreateUserFormValues, UserDto } from "./types";

/** Tên hiển thị: họ tên nếu có, không thì tên đăng nhập. */
export function userDisplayName(user: Pick<UserDto, "fullName" | "username">): string {
  return user.fullName?.trim() || user.username;
}

/** Thêm / bỏ một giá trị khỏi danh sách, giữ thứ tự và không trùng. */
export function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Hai tập giá trị bằng nhau, không phụ thuộc thứ tự. */
export function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

interface ScopedRole {
  code: string;
  dataScope?: string | null;
}

/**
 * Vai trò nào trong tập đã chọn chỉ thấy dữ liệu theo kho được gán (BE PR #73: `dataScope = WAREHOUSE`).
 * Người giữ vai trò này mà chưa được gán kho thì không chạm được dữ liệu kho nào.
 */
export function warehouseBoundRoles(
  selectedCodes: readonly string[],
  roles: readonly ScopedRole[],
): string[] {
  const selected = new Set(selectedCodes);
  return roles
    .filter((role) => selected.has(role.code) && role.dataScope === "WAREHOUSE")
    .map((role) => role.code);
}

/** Body `POST /identity/users` từ giá trị form — chuỗi rỗng bị bỏ để BE tự sinh mật khẩu / bỏ qua họ tên. */
export function toCreateUserRequest(values: CreateUserFormValues) {
  return {
    username: values.username.trim(),
    email: values.email.trim(),
    ...(values.fullName.trim() ? { fullName: values.fullName.trim() } : {}),
    ...(values.password ? { password: values.password } : {}),
    roles: values.roles,
    warehouseIds: values.warehouseIds,
  };
}

/** Tạo ô lọc theo trạng thái cho DataTable: một trạng thái hoặc không lọc. */
export function singleStatus<T extends string>(statuses: readonly T[]): T | undefined {
  return statuses.length === 1 ? statuses[0] : undefined;
}
