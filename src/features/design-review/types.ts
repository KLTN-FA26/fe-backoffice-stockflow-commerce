import type { z } from "zod";

import type {
  artifactLinkSchema,
  designApproveInputSchema,
  designArtifactDtoSchema,
  designDecisionDtoSchema,
  designDecisionInputSchema,
  designDtoSchema,
  designPreflightDtoSchema,
  designQuoteRequestDtoSchema,
  designReturnInputSchema,
  reviewRoundDtoSchema,
  roundApprovalDtoSchema,
} from "./schemas";

export type Design = z.infer<typeof designDtoSchema>;
export type DesignDecision = z.infer<typeof designDecisionDtoSchema>;
export type DesignArtifact = z.infer<typeof designArtifactDtoSchema>;
export type DesignPreflight = z.infer<typeof designPreflightDtoSchema>;
export type ArtifactLink = z.infer<typeof artifactLinkSchema>;
export type DesignQuoteRequest = z.infer<typeof designQuoteRequestDtoSchema>;
export type DesignDecisionInput = z.input<typeof designDecisionInputSchema>;
export type DesignDecisionOutput = z.output<typeof designDecisionInputSchema>;
export type DesignApproveFormValues = z.input<typeof designApproveInputSchema>;
export type DesignApproveFormOutput = z.output<typeof designApproveInputSchema>;
export type DesignReturnFormValues = z.input<typeof designReturnInputSchema>;
export type DesignReturnFormOutput = z.output<typeof designReturnInputSchema>;
export type ReviewRound = z.infer<typeof reviewRoundDtoSchema>;
export type ReviewRoundDesign = ReviewRound["designs"][number];
export type RoundApproval = z.infer<typeof roundApprovalDtoSchema>;
export type RoundApprovalOutcome = RoundApproval["outcomes"][number];
