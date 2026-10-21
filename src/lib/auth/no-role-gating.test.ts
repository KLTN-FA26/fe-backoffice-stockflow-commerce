// @vitest-environment node
/**
 * Luật của lead (22/10): MỌI kiểm tra quyền đi qua hệ thống quyền (`/identity/me/permissions`,
 * `can()` / `useCan()`), KHÔNG bao giờ gắn cứng tên vai trò — để admin cấp quyền cho vai trò khác trên
 * màn Phân quyền là có hiệu lực ngay, không cần sửa code (BE PR #148 làm điều tương tự ở backend,
 * `NoRoleNameAccessTest`).
 *
 * Test này quét mã nguồn production trong `src/` (bỏ test / fixture / tài liệu) và FAIL nếu thấy tên vai
 * trò hoặc cách đọc vai trò dùng để quyết định quyền. Tên vai trò chỉ được xuất hiện ở các file trong
 * `ALLOWED` bên dưới — mỗi file kèm lý do (hiển thị, dữ liệu mock, điều kiện của NGƯỜI ĐƯỢC GÁN chứ không
 * phải quyền người gọi). Mục allow-list không còn khớp gì sẽ FAIL để danh sách không phình ra.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(process.cwd(), "src");

const ROLE_CODES = [
  "SYSTEM_ADMIN",
  "ECOMMERCE_ADMIN",
  "WAREHOUSE_MANAGER",
  "WAREHOUSE_STAFF",
  "ORDER_COORDINATOR",
  "QC_STAFF",
  "SALES_STAFF",
  "ACCOUNTANT",
  "PROCUREMENT_STAFF",
  "INVENTORY_PLANNER",
];
const ROLE_NAMES = [
  "System Admin",
  "E-commerce Admin",
  "Warehouse Manager",
  "Warehouse Staff",
  "Order Coordinator",
  "QC Staff",
  "Sales Staff",
  "Accountant",
  "Procurement Staff",
  "Inventory Planner",
];

/** Mỗi mẫu = một cách gắn cứng vai trò vào quyết định quyền. */
const PATTERNS: readonly { name: string; regex: RegExp }[] = [
  { name: "STAFF_ROLE / StaffRole", regex: /\b(STAFF_ROLE|StaffRole)\b/ },
  { name: "hasStaffRole / hasAnyRole / hasRole", regex: /\b(hasStaffRole|hasAnyRole|hasRole)\b/ },
  {
    name: "mã vai trò BE dạng chuỗi",
    regex: new RegExp(`["'\`](${ROLE_CODES.join("|")})["'\`]`),
  },
  {
    name: "tên vai trò hiển thị dạng chuỗi",
    regex: new RegExp(`["'\`](${ROLE_NAMES.join("|")})["'\`]`),
  },
  {
    name: "so khớp danh sách vai trò (roles.includes / some / every / find)",
    regex: /\broles\s*\.\s*(includes|some|every|find|indexOf)\s*\(/,
  },
];

/**
 * File được phép nhắc tên vai trò — KHÔNG file nào quyết định quyền của người đang đăng nhập.
 * Thêm mục mới cần lý do rõ ràng; nếu là quyết định quyền thì dùng mã quyền.
 */
const ALLOWED: Record<string, string> = {
  "src/lib/auth/roles.ts":
    "danh sách tên vai trò của tài khoản demo (kiểu RoleName), dữ liệu hiển thị",
  "src/lib/auth/auth-store.ts":
    "effectiveRoles() chỉ để RoleSwitcher đánh dấu vai trò demo đang xem; không quyết định quyền",
  "src/lib/auth/components/RoleSwitcher.tsx": "công cụ demo đổi nhãn vai trò, nhãn hiển thị",
  "src/lib/mock-data.ts":
    "dữ liệu tài khoản demo (staffUsers.roles) — dữ liệu, không phải cổng quyền",
  "src/lib/api/mock-backend-roles.ts":
    "đổi tên vai trò demo → mã vai trò BE để trả trong `roles` của /identity/me/permissions (chỉ hiển thị)",
  "src/lib/api/mock-routes-fulfillment.ts":
    "mock `requireWarehouseAssignee` (ai NHẬN việc phải là NV / quản lý kho) và bộ lọc `GET /identity/users?role=`; quyền người gọi theo mã quyền",
  "src/features/fulfillment/reference-api.ts":
    "ASSIGNABLE_ROLES là bộ lọc danh sách người nhận (`GET /identity/users?role=`), phản chiếu BE `requireWarehouseAssignee`; quyền gán / tạo task là fulfillment-task-assignment:*",
  "src/lib/auth/server/mock-role-matrices.ts":
    "danh mục vai trò demo cho màn Phân quyền (dữ liệu mock của ma trận quyền)",
  "src/features/permission-management/components/PermissionManagementPage.tsx":
    "`roles` là danh mục vai trò trên màn Phân quyền (chọn vai trò để sửa ma trận), không phải vai trò người dùng",
};

const SKIP_DIRS = new Set(["_design", "__fixtures__", "node_modules"]);
const SKIP_FILE = /(\.test\.(ts|tsx)|\.spec\.(ts|tsx)|test-support\.tsx?)$/;

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...listSources(full));
    } else if (/\.(ts|tsx)$/.test(name) && !SKIP_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Bỏ chú thích — chú thích được phép nhắc vai trò (ví dụ "seed BE cấp cho WAREHOUSE_MANAGER"). */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

export function findRoleGating(source: string): string[] {
  const code = stripComments(source);
  return PATTERNS.filter(({ regex }) => regex.test(code)).map(({ name }) => name);
}

const relative = (file: string) => path.relative(process.cwd(), file).split(path.sep).join("/");

describe("không gắn cứng tên vai trò để quyết định quyền (luật 22/10)", () => {
  const files = listSources(SRC);

  it("quét được mã nguồn production", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("không file nào ngoài allow-list dùng tên vai trò", () => {
    const offenders = files
      .map((file) => ({ file: relative(file), hits: findRoleGating(readFileSync(file, "utf8")) }))
      .filter(({ file, hits }) => hits.length > 0 && !(file in ALLOWED))
      .map(({ file, hits }) => `${file}: ${hits.join("; ")}`);
    expect(
      offenders,
      "Dùng mã quyền (can()/useCan(), src/constants/permissions.ts) thay vì tên vai trò",
    ).toEqual([]);
  });

  it("mọi mục allow-list còn khớp và còn tồn tại (không để mục thừa)", () => {
    const stale = Object.keys(ALLOWED).filter((file) => {
      const full = path.resolve(process.cwd(), file);
      try {
        return findRoleGating(readFileSync(full, "utf8")).length === 0;
      } catch {
        return true;
      }
    });
    expect(stale).toEqual([]);
  });

  it("mỗi mục allow-list có lý do", () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, file).toBeGreaterThan(20);
    }
  });
});

describe("bộ quét bắt đúng những gì cần bắt", () => {
  it("bắt các cách gắn cứng vai trò", () => {
    expect(findRoleGating("hasStaffRole(actor, [STAFF_ROLE.QC_STAFF])")).toEqual(
      expect.arrayContaining(["STAFF_ROLE / StaffRole", "hasStaffRole / hasAnyRole / hasRole"]),
    );
    expect(findRoleGating('if (user.roles.includes("WAREHOUSE_MANAGER")) return true;')).toEqual(
      expect.arrayContaining([
        "mã vai trò BE dạng chuỗi",
        "so khớp danh sách vai trò (roles.includes / some / every / find)",
      ]),
    );
    expect(findRoleGating('const allowed = role === "Warehouse Manager";')).toEqual([
      "tên vai trò hiển thị dạng chuỗi",
    ]);
    expect(findRoleGating("actor.roles.some((r) => r === admin)")).toEqual([
      "so khớp danh sách vai trò (roles.includes / some / every / find)",
    ]);
  });

  it("không bắt chú thích và mã dùng mã quyền", () => {
    expect(findRoleGating("// seed BE cấp cho WAREHOUSE_MANAGER và ORDER_COORDINATOR")).toEqual([]);
    expect(findRoleGating("/** QC_STAFF chỉ đọc */\nconst ok = can(PACK.read);")).toEqual([]);
    expect(findRoleGating('const url = "http://x"; const ok = can("sales-orders:READ");')).toEqual(
      [],
    );
  });
});
