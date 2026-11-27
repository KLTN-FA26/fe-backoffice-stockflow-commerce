import type { z } from "zod";

import type { creditPositionDtoSchema, creditProfileInputSchema } from "./credit-profile-schemas";
import type {
  creditProfileDtoSchema,
  customerCreateInputSchema,
  customerDtoSchema,
  customerStatusEntryDtoSchema,
  customerUpdateInputSchema,
  invitedCustomerDtoSchema,
  legalProfileDtoSchema,
  legalProfileInputSchema,
  portalActivationInputSchema,
  portalInvitationDtoSchema,
} from "./schemas";

export type Customer = z.infer<typeof customerDtoSchema>;
export type CustomerStatusEntry = z.infer<typeof customerStatusEntryDtoSchema>;
export type InvitedCustomer = z.infer<typeof invitedCustomerDtoSchema>;
export type PortalInvitation = z.infer<typeof portalInvitationDtoSchema>;
export type CreditProfile = z.infer<typeof creditProfileDtoSchema>;
export type CreditPosition = z.infer<typeof creditPositionDtoSchema>;
export type CreditProfileValues = z.infer<typeof creditProfileInputSchema>;
export type CustomerCreateValues = z.infer<typeof customerCreateInputSchema>;
export type CustomerUpdateValues = z.infer<typeof customerUpdateInputSchema>;
export type LegalProfile = z.infer<typeof legalProfileDtoSchema>;
export type LegalProfileValues = z.infer<typeof legalProfileInputSchema>;
export type PortalActivationValues = z.infer<typeof portalActivationInputSchema>;
