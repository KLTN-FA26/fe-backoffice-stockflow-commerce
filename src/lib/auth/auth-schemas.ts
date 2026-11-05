import { z } from "zod";

import { CHANGE_PASSWORD_UI, PASSWORD_LIMITS } from "@/constants/auth";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// BE develop: identity/internal/controller/dto/MeResponse.java and MeController.me.
// fullName and lastLoginAt are nullable in V20260902001200__identity_users_roles.sql, and the BE
// (`default-property-inclusion: non_null`) OMITS null fields instead of sending null — so accept both
// and normalise to null. A strict `.nullable()` here made login fail for accounts without a full name.
// mustChangePassword is a primitive boolean (V20261012000100), always sent — so it stays required.
// Keep role authorities verbatim; the legacy UI role registry is a separate concern.
const nullishToNull = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);

export const authUserSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  email: z.string(),
  fullName: nullishToNull(z.string()),
  status: z.string(),
  roles: z.array(z.string()),
  lastLoginAt: nullishToNull(z.iso.datetime({ offset: true })),
  mustChangePassword: z.boolean(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginResponse = AuthUser;

/**
 * Change-password form (BE `ChangePasswordRequest` + `PasswordPolicy`). The new password is checked
 * here only so the user gets the message before a round trip; the BE re-checks everything.
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, CHANGE_PASSWORD_UI.currentRequired),
    newPassword: z
      .string()
      .min(PASSWORD_LIMITS.min, CHANGE_PASSWORD_UI.newRequired)
      .max(PASSWORD_LIMITS.max, CHANGE_PASSWORD_UI.newRequired)
      .regex(PASSWORD_LIMITS.pattern, CHANGE_PASSWORD_UI.newRequired),
    confirmPassword: z.string(),
    logoutOtherDevices: z.boolean(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: CHANGE_PASSWORD_UI.confirmMismatch,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: CHANGE_PASSWORD_UI.sameAsCurrent,
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

/** What the browser sends to the BFF (and the BFF to Spring). */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  logoutOtherDevices: z.boolean().default(false),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** BE `SessionsEndedResponse`: how many other sessions the change ended. */
export const changePasswordResultSchema = z.object({ revokedSessions: z.number().int().min(0) });
export type ChangePasswordResult = z.infer<typeof changePasswordResultSchema>;
