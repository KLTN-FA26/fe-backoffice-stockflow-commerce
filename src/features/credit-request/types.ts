import type { z } from "zod";

import type {
  approveInputFor,
  creditRequestCreateInput,
  creditRequestDtoSchema,
  creditRequestFileSchema,
  creditRequestRecommendInput,
  creditRequestRejectInput,
  creditRequestReviewSchema,
} from "./schemas";

export type CreditRequest = z.infer<typeof creditRequestDtoSchema>;
export type CreditRequestFile = z.infer<typeof creditRequestFileSchema>;
export type CreditRequestReview = z.infer<typeof creditRequestReviewSchema>;
export type CreditRequestStatus = CreditRequest["status"];
export type CreditRequestCreateValues = z.input<typeof creditRequestCreateInput>;
export type CreditRequestCreateBody = z.output<typeof creditRequestCreateInput>;
export type CreditRequestRecommendValues = z.input<typeof creditRequestRecommendInput>;
export type CreditRequestRecommendBody = z.output<typeof creditRequestRecommendInput>;
export type CreditRequestApproveValues = z.input<ReturnType<typeof approveInputFor>>;
export type CreditRequestApproveBody = z.output<ReturnType<typeof approveInputFor>>;
export type CreditRequestRejectBody = z.output<typeof creditRequestRejectInput>;
