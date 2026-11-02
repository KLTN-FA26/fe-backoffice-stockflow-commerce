import type { z } from "zod";
import type { notificationDto, notificationListParams, notificationPageDto } from "./schemas";

export type Notification = z.infer<typeof notificationDto>;
export type NotificationPage = z.infer<typeof notificationPageDto>;
export type NotificationListParams = z.infer<typeof notificationListParams>;
