import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getUser, listUserStatusChanges, listUsers } from "./api";

import type { ListUserParams } from "./api";
import type { UserDto } from "./types";

export const userKeys = createQueryKeys<ListUserParams>("identity-users");

export const useUsers = createListQuery<UserDto, ListUserParams>(userKeys, listUsers);

export const useUser = createDetailQuery<UserDto>(userKeys, getUser);

/**
 * Lịch sử trạng thái của một tài khoản (SCRUM-474 LOCK-REASON). Khoá nằm dưới `userKeys.all` để mọi
 * mutation của màn (invalidate `userKeys.all`) làm mới luôn cả lịch sử.
 */
export const userStatusChangeKey = (userId: string, page: number) =>
  [...userKeys.all, "status-changes", userId, page] as const;

export function useUserStatusChanges(userId: string, page: number, enabled = true) {
  return useQuery({
    queryKey: userStatusChangeKey(userId, page),
    queryFn: ({ signal }) => listUserStatusChanges(userId, { page }, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
