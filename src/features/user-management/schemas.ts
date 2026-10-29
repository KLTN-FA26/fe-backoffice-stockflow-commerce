import { z } from "zod";

import { USER_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { USER_LIMITS, USER_SORT_FIELDS, USER_STATUS_CHANGE_ACTIONS } from "./constants";

export const userStatusSchema = z.enum(USER_STATUSES);

/** BE `UserStatusChangeResponse` (SCRUM-474 LOCK-REASON): one administrator lock / unlock / disable / enable. */
export const userStatusChangeSchema = z.object({
  id: z.string().min(1),
  action: z.enum(USER_STATUS_CHANGE_ACTIONS),
  fromStatus: userStatusSchema,
  toStatus: userStatusSchema,
  reason: z.string(),
  actorId: z.string().nullish(),
  actorUsername: z.string(),
  changedAt: z.string(),
});

/** BE `UserResponse` (PR #72 + `warehouseIds` của PR #73). Trường rỗng bị BE bỏ khỏi JSON (non_null). */
export const userDtoSchema = z.object({
  userId: z.string().min(1),
  username: z.string(),
  email: z.string(),
  fullName: z.string().nullish(),
  status: userStatusSchema,
  roles: z.array(z.string()).default([]),
  warehouseIds: z.array(z.string()).default([]),
  mustChangePassword: z.boolean().default(false),
  lockedUntil: z.string().nullish(),
  lastLoginAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  createdBy: z.string().nullish(),
  /** Absent when the account never had an administrator status change (or predates SCRUM-474). */
  latestStatusChange: userStatusChangeSchema.nullish(),
  version: z.number().int().nonnegative(),
});

export const userPageSchema = bePageSchema(userDtoSchema);
export const userStatusChangePageSchema = bePageSchema(userStatusChangeSchema);

/** The reason dialog (SCRUM-474 LOCK-REASON): 5-500 characters after trimming, like the BE. */
export const statusReasonSchema = z
  .string()
  .trim()
  .min(USER_LIMITS.reasonMin, `Lý do tối thiểu ${USER_LIMITS.reasonMin} ký tự.`)
  .max(USER_LIMITS.reasonMax, `Lý do tối đa ${USER_LIMITS.reasonMax} ký tự.`);

/** BE `CreatedUserResponse`: mật khẩu tạm chỉ có khi BE tự sinh (không gửi `password`), chỉ hiện một lần. */
export const createdUserSchema = z.object({
  user: userDtoSchema,
  temporaryPassword: z.string().nullish(),
});

/** BE `PasswordResetResponse`. */
export const passwordResetResultSchema = z.object({
  temporaryPassword: z.string().nullish(),
  sessionsEnded: z.number().int().nonnegative().default(0),
});

export const userSortSchema = z.enum(USER_SORT_FIELDS);

/* ── Input: form → BE request ─────────────────────────────────────────── */

const L = USER_LIMITS;
const PASSWORD_MESSAGE = `Mật khẩu ${L.passwordMin}–${L.passwordMax} ký tự, gồm chữ hoa, chữ thường và chữ số.`;

// BE `PasswordPolicy`: 10–72 ký tự + chữ hoa + chữ thường + chữ số. Để trống = BE tự sinh mật khẩu tạm.
const optionalPassword = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (value.length >= L.passwordMin &&
        value.length <= L.passwordMax &&
        L.passwordPattern.test(value)),
    PASSWORD_MESSAGE,
  );

// `@Email` của Hibernate Validator khá lỏng (chấp nhận `a@b`); chỉ chặn khoảng trắng và thiếu @.
const emailSchema = z
  .string()
  .trim()
  .min(1, "Nhập email.")
  .max(L.emailMax, `Email tối đa ${L.emailMax} ký tự.`)
  .regex(/^[^\s@]+@[^\s@]+$/, "Email không hợp lệ.");

const fullNameSchema = z
  .string()
  .trim()
  .max(L.fullNameMax, `Họ tên tối đa ${L.fullNameMax} ký tự.`);

export const createUserFormSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      L.usernamePattern,
      "Tên đăng nhập 3–100 ký tự: chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.",
    ),
  email: emailSchema,
  fullName: fullNameSchema,
  password: optionalPassword,
  roles: z
    .array(z.string().min(1))
    .min(1, "Chọn ít nhất một vai trò.")
    .max(L.rolesMax, `Tối đa ${L.rolesMax} vai trò.`),
  warehouseIds: z.array(z.string().min(1)).max(L.warehousesMax, `Tối đa ${L.warehousesMax} kho.`),
});

export const updateUserFormSchema = z.object({ email: emailSchema, fullName: fullNameSchema });

export const resetPasswordFormSchema = z.object({ newPassword: optionalPassword });

export const assignWarehousesSchema = z.object({
  warehouseIds: z.array(z.string().min(1)).max(L.warehousesMax),
});
