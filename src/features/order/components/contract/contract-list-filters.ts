import { debounce, parseAsArrayOf, parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

import { CONTRACT_ESIGN_PATHS } from "@/constants/contract-esign";

import { usePagedList } from "@/hooks/use-paged-list";
import { toLocalIsoDate } from "@/lib/format/date";

const NO_SORT = new Set<string>();
export function useContractListFilters() {
  const paged = usePagedList(CONTRACT_ESIGN_PATHS.storage, NO_SORT);
  const [values, setValues] = useQueryStates({
    status: parseAsArrayOf(parseAsString).withDefault([]),
    q: parseAsString.withDefault(""),
    salesOwnerId: parseAsString.withDefault(""),
    mine: parseAsBoolean.withDefault(false),
    signByBefore: parseAsString.withDefault(""),
    termsReview: parseAsString.withDefault(""),
  });
  const set = (patch: Partial<typeof values>) => {
    void setValues(patch, { limitUrlUpdates: "q" in patch ? debounce(300) : undefined });
    paged.resetPage();
  };
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return {
    values,
    set,
    paged,
    soonDate: toLocalIsoDate(deadline.toISOString()),
    hasFilters: !!(
      values.status.length ||
      values.q ||
      values.salesOwnerId ||
      values.mine ||
      values.signByBefore ||
      values.termsReview
    ),
    reset: () => {
      void setValues(null);
      paged.resetPage();
    },
    params: {
      page: paged.apiPage,
      size: paged.pageSize,
      status: values.status.length ? values.status : undefined,
      q: values.q || undefined,
      salesOwnerId: values.salesOwnerId || undefined,
      mine: values.mine || undefined,
      signByBefore: values.signByBefore || undefined,
      termsReview: values.termsReview || undefined,
    },
  };
}
