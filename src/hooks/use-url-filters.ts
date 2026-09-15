/**
 * URL-based list filters — nuqs wrapper.
 *
 * Replaces `useState` filter/sort/page with URL search params.
 * Benefits: shareable links, F5 preserves state, back/forward works.
 */

"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useDebouncedValue } from "./use-debounced-value";

interface UrlFilterKeys {
  page?: string;
  q?: string;
  sort?: string;
  status?: string;
}

interface UrlFilterOptions {
  keys?: UrlFilterKeys;
}

/**
 * Generic list filters hook.
 *
 * @param statusEnum — readonly array of allowed status values (e.g. PO_STATUSES)
 */
export function useUrlTab<T extends string>(key: string, values: readonly T[], defaultValue: T) {
  return useQueryState(key, parseAsStringLiteral(values).withDefault(defaultValue));
}

export function useUrlFilters<S extends string>(
  statusEnum: readonly S[],
  options: UrlFilterOptions = {},
) {
  const keys = options.keys ?? {};
  const [status, setStatus] = useQueryState(
    keys.status ?? "status",
    parseAsArrayOf(parseAsStringLiteral(statusEnum)).withDefault([]),
  );

  const [q, setQ] = useQueryState(keys.q ?? "q", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState(keys.page ?? "page", parseAsInteger.withDefault(1));
  const [sort, setSort] = useQueryState(keys.sort ?? "sort", parseAsString.withDefault(""));

  const debouncedQ = useDebouncedValue(q, 300);

  const setStatusAndResetPage = (s: S[]) => {
    setStatus(s);
    setPage(1);
  };

  const setQAndResetPage = (v: string) => {
    setQ(v);
    setPage(1);
  };

  const reset = () => {
    setStatus([]);
    setQ("");
    setPage(1);
    setSort("");
  };

  return {
    status,
    setStatus: setStatusAndResetPage,
    q,
    setQ: setQAndResetPage,
    debouncedQ,
    page,
    setPage,
    sort,
    setSort,
    reset,
  };
}
