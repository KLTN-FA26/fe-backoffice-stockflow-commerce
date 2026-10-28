import { z } from "zod";

import { NOTIFICATION_SEVERITIES } from "@/constants/notifications";

/** BE PR #102: nullable fields are omitted by Jackson NON_NULL. */
export const notificationDto = z.object({
  id: z.uuid(),
  category: z.string().min(1),
  severity: z.enum(NOTIFICATION_SEVERITIES),
  title: z.string().min(1),
  body: z.string().nullish(),
  // Reject protocol-relative/external paths before passing them to the router.
  link: z
    .string()
    .regex(/^\/(?![\\/])[^\\]*$/)
    .nullish(),
  sourceType: z.string().nullish(),
  sourceId: z.string().nullish(),
  createdAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullish(),
  read: z.boolean(),
});

export const notificationPageDto = z.object({
  items: z.array(notificationDto),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
  unreadCount: z.number().int().nonnegative(),
});

export const notificationUnreadCountDto = z.object({ unreadCount: z.number().int().nonnegative() });
export const notificationMarkAllDto = z.object({ updated: z.number().int().nonnegative() });

export const notificationListParams = z.object({
  unreadOnly: z.boolean().default(false),
  page: z.number().int().nonnegative(),
  size: z.number().int().min(1).max(200),
});
