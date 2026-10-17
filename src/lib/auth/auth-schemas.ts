import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// BE develop: identity/internal/controller/dto/MeResponse.java and MeController.me.
// fullName and lastLoginAt are nullable in V20260902001200__identity_users_roles.sql, and Spring's
// `jackson.default-property-inclusion: non_null` omits null fields, so absent normalizes to null.
// mustChangePassword is a primitive boolean (V20261012000100), always sent.
// Keep role authorities verbatim; the legacy UI role registry is a separate concern.
export const authUserSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  email: z.string(),
  fullName: z.string().nullable().default(null),
  status: z.string(),
  roles: z.array(z.string()),
  lastLoginAt: z.iso.datetime({ offset: true }).nullable().default(null),
  mustChangePassword: z.boolean(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginResponse = AuthUser;
