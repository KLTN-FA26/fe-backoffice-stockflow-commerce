import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getSample, listSamples } from "./api";

import type { ListSampleParams } from "./api";
import type { SampleDetail, SampleRow } from "./types";

export const sampleKeys = createQueryKeys<ListSampleParams>("sample-requests");

export const useSamples = createListQuery<SampleRow, ListSampleParams>(sampleKeys, listSamples);
export const useSample = createDetailQuery<SampleDetail>(sampleKeys, getSample);
