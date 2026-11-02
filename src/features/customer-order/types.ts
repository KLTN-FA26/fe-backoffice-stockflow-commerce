import type { z } from "zod";
import type { myOrderCardDtoSchema, myOrderDetailDtoSchema } from "./schemas";

export type MyOrderCard = z.infer<typeof myOrderCardDtoSchema>;
export type MyOrderDetail = z.infer<typeof myOrderDetailDtoSchema>;
