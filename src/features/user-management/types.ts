import type { z } from "zod";

import type {
  assignWarehousesSchema,
  createdUserSchema,
  createUserFormSchema,
  passwordResetResultSchema,
  resetPasswordFormSchema,
  updateUserFormSchema,
  userDtoSchema,
  userSortSchema,
  userStatusSchema,
} from "./schemas";

export type UserDto = z.infer<typeof userDtoSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type UserSortField = z.infer<typeof userSortSchema>;
export type CreatedUser = z.infer<typeof createdUserSchema>;
export type PasswordResetResult = z.infer<typeof passwordResetResultSchema>;
export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
export type AssignWarehousesInput = z.infer<typeof assignWarehousesSchema>;

export type { UserStatusAction } from "./lifecycle";
