import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// BE develop: identity/internal/controller/dto/MeResponse.java and MeController.me.
// fullName and lastLoginAt are nullable in V20260902001200__identity_users_roles.sql, and the BE
// (`default-property-inclusion: non_null`) OMITS null fields instead of sending null — so accept both
// and normalise to null. A strict `.nullable()` here made login fail for accounts without a full name.
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
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginResponse = AuthUser;
