import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getUser, listUsers } from "./api";

import type { ListUserParams } from "./api";
import type { UserDto } from "./types";

export const userKeys = createQueryKeys<ListUserParams>("identity-users");

export const useUsers = createListQuery<UserDto, ListUserParams>(userKeys, listUsers);

export const useUser = createDetailQuery<UserDto>(userKeys, getUser);
