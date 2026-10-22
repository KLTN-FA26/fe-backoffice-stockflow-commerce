import type { z } from "zod";

import type {
  creditProfileDtoSchema,
  customerCreateInputSchema,
  customerDtoSchema,
  customerStatusEntryDtoSchema,
  customerUpdateInputSchema,
  invitedCustomerDtoSchema,
  portalActivationInputSchema,
  portalInvitationDtoSchema,
} from "./schemas";

export type Customer = z.infer<typeof customerDtoSchema>;
export type CustomerStatusEntry = z.infer<typeof customerStatusEntryDtoSchema>;
export type InvitedCustomer = z.infer<typeof invitedCustomerDtoSchema>;
export type PortalInvitation = z.infer<typeof portalInvitationDtoSchema>;
export type CreditProfile = z.infer<typeof creditProfileDtoSchema>;
export type CustomerCreateValues = z.infer<typeof customerCreateInputSchema>;
export type CustomerUpdateValues = z.infer<typeof customerUpdateInputSchema>;
export type PortalActivationValues = z.infer<typeof portalActivationInputSchema>;
