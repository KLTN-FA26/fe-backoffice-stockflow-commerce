import type { z } from "zod";

import type {
  artifactLinkSchema,
  designArtifactDtoSchema,
  designDecisionDtoSchema,
  designDecisionInputSchema,
  designDtoSchema,
  designPreflightDtoSchema,
  designQuoteRequestDtoSchema,
  designReturnInputSchema,
} from "./schemas";

export type Design = z.infer<typeof designDtoSchema>;
export type DesignDecision = z.infer<typeof designDecisionDtoSchema>;
export type DesignArtifact = z.infer<typeof designArtifactDtoSchema>;
export type DesignPreflight = z.infer<typeof designPreflightDtoSchema>;
export type ArtifactLink = z.infer<typeof artifactLinkSchema>;
export type DesignQuoteRequest = z.infer<typeof designQuoteRequestDtoSchema>;
export type DesignDecisionInput = z.input<typeof designDecisionInputSchema>;
export type DesignDecisionOutput = z.output<typeof designDecisionInputSchema>;
export type DesignReturnFormValues = z.input<typeof designReturnInputSchema>;
export type DesignReturnFormOutput = z.output<typeof designReturnInputSchema>;
