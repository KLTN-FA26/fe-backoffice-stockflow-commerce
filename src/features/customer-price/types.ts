/** Kiểu của feature bảng giá khách hàng — chỉ `z.infer` từ `schemas.ts` (không khai báo tay). */
export type {
  CustomerPrice,
  CustomerPriceTier,
  CustomerPriceValues,
  ValidCustomerPriceValues,
} from "./schemas";
export type { CreateCustomerPriceInput, UpdateCustomerPriceInput } from "./api";
export type { CustomerPriceErrorKind } from "./errors";
